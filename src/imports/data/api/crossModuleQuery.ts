import { ChildProcess } from 'child_process';
import { Readable } from 'node:stream';
import pLimit from 'p-limit';

import { getUserSafe } from '@imports/auth/getUser';
import { getAccessFor } from '@imports/utils/accessUtils';
import { logger } from '@imports/utils/logger';
import { errorReturn } from '@imports/utils/return';
import { KonectyResultError } from '@imports/types/result';
import type { User } from '@imports/model/User';
import type { Span } from '@opentelemetry/api';

import findStream from './findStream';
import { createPythonProcess } from './pythonStreamBridge';
import { NEWLINE_SEPARATOR } from './streamConstants';
import { validateCrossModuleQuery, resolveRelationLookup, buildRelationFilter } from './crossModuleQueryValidator';

import type {
	CrossModuleQuery,
	CrossModuleRelation,
	CrossModuleQueryParams,
	CrossModulePythonConfig,
	CrossModuleRPCRequest,
	CrossModuleMeta,
	CrossModuleWarning,
	RelationPythonConfig,
} from '@imports/types/crossModuleQuery';

const CROSS_QUERY_MAX_RECORDS = parseInt(process.env.CROSS_QUERY_MAX_RECORDS ?? '100000', 10);
const RELATION_CONCURRENCY = 3;
const DATASET_TAG = '_dataset';
/** Threshold above which a relation dataset triggers a LARGE_DATASET warning (ADR-0012: no-magic-numbers). */
const LARGE_DATASET_WARNING_THRESHOLD = 50_000;

import path from 'node:path';

/** Script paths for cross-module join. Python is run via uv (ADR-0006); createPythonProcess uses `uv run --script`. */
const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'src', 'scripts', 'python', 'cross_module_join.py');
const PYTHON_SCRIPT_PATH_DOCKER = path.join('/app', 'scripts', 'python', 'cross_module_join.py');

interface CrossModuleResult {
	success: true;
	meta: CrossModuleMeta;
	records: Record<string, unknown>[];
	total?: number;
}

export default async function crossModuleQuery({ authTokenId, contextUser, body, tracingSpan }: CrossModuleQueryParams): Promise<CrossModuleResult | KonectyResultError> {
	let pythonProcess: ChildProcess | null = null;
	const startTime = Date.now();

	try {
		// Step 1: Validate input
		tracingSpan?.addEvent('Validating cross-module query');
		const validation = validateCrossModuleQuery(body);
		if (!validation.success) {
			return { success: false, errors: validation.errors };
		}
		const query = validation.query;

		// Step 2: Authenticate user (Layer 1)
		tracingSpan?.addEvent('Authenticating user');
		const userResult = await getUserSafe(authTokenId, contextUser);
		if (userResult.success === false) {
			return userResult;
		}
		const user = userResult.data;

		// Step 3: Check primary document access (Layer 2 - MUST pass)
		const primaryAccess = getAccessFor(query.document, user);
		if (primaryAccess === false) {
			return errorReturn('dataExplorer.errors.primaryNoReadAccess');
		}

		// Step 4: Execute primary findStream (Layers 2-6)
		tracingSpan?.addEvent('Executing primary findStream');
		const augmentedFields = buildAugmentedFields(query);
		const primaryStreamResult = await findStream({
			authTokenId,
			contextUser: user,
			document: query.document,
			fields: augmentedFields,
			filter: query.filter,
			sort: query.sort,
			limit: Math.min(query.limit, CROSS_QUERY_MAX_RECORDS),
			start: query.start,
			getTotal: query.includeTotal,
			transformDatesToString: true,
			tracingSpan,
		});

		if (primaryStreamResult.success === false) {
			return primaryStreamResult;
		}

		const { data: primaryStream, total } = primaryStreamResult;

		// Step 5: Collect primary records from stream
		tracingSpan?.addEvent('Collecting primary records');
		const primaryRecords = await collectStreamData(primaryStream);
		logger.debug({ document: query.document, count: primaryRecords.length }, 'Cross-module query: collected primary records');

		if (primaryRecords.length === 0) {
			return {
				success: true,
				meta: buildMeta(query, [], Date.now() - startTime),
				records: [],
				total: total ?? 0,
			};
		}

		// Step 6: Process relations (collect data per relation, check access)
		tracingSpan?.addEvent('Processing relations');
		const warnings: CrossModuleWarning[] = [];
		const allDatasets: Map<string, Record<string, unknown>[]> = new Map();

		// Tag primary records
		const taggedPrimary = primaryRecords.map(r => ({ ...r, [DATASET_TAG]: query.document }));
		allDatasets.set(query.document, taggedPrimary);

		const hasRelations = query.relations.length > 0;
		const hasGroupBy = query.groupBy.length > 0;
		const hasRootAggregators = Object.keys(query.aggregators).length > 0;
		const needsPython = hasRelations || hasGroupBy || hasRootAggregators;

		const pythonConfig = hasRelations
			? await processRelationsRecursive(query.document, primaryRecords, query.relations, user, authTokenId, allDatasets, warnings, tracingSpan)
			: [];

		if (primaryRecords.length === 0 && allDatasets.size <= 1) {
			return {
				success: true,
				meta: buildMeta(query, warnings, Date.now() - startTime),
				records: [],
				total: total ?? 0,
			};
		}

		let mergedRecords: Record<string, unknown>[];

		if (needsPython) {
			// Step 7: Spawn Python process via uv (ADR-0006) and send data
			tracingSpan?.addEvent('Spawning Python process');
			const scriptPath = process.env.NODE_ENV === 'production' ? PYTHON_SCRIPT_PATH_DOCKER : PYTHON_SCRIPT_PATH;
			pythonProcess = createPythonProcess(scriptPath);

			const config: CrossModulePythonConfig = {
				parentDataset: query.document,
				relations: pythonConfig,
				...(hasGroupBy ? { groupBy: query.groupBy } : {}),
				...(hasRootAggregators ? { aggregators: query.aggregators } : {}),
			};

			// Send RPC request
			await sendRPC(pythonProcess, config);

			// Send all datasets as tagged NDJSON
			tracingSpan?.addEvent('Sending data to Python');
			await sendDatasets(pythonProcess, allDatasets);

			// Step 8: Read results from Python
			tracingSpan?.addEvent('Collecting results from Python');
			mergedRecords = await collectPythonResults(pythonProcess);
		} else {
			mergedRecords = primaryRecords;
		}

		if (total != null && total > CROSS_QUERY_MAX_RECORDS) {
			warnings.push({
				type: 'LIMIT_REACHED',
				message: 'dataExplorer.warnings.resultLimitReached',
			});
		}

		const executionTimeMs = Date.now() - startTime;
		logger.debug({ executionTimeMs, recordCount: mergedRecords.length, warningCount: warnings.length }, 'Cross-module query completed');

		return {
			success: true,
			meta: buildMeta(query, warnings, executionTimeMs),
			records: mergedRecords,
			total: total ?? primaryRecords.length,
		};
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);
		logger.error(error, `Error executing cross-module query: ${error.message}`);

		if (pythonProcess != null && !pythonProcess.killed) {
			try {
				pythonProcess.kill();
			} catch (killError) {
				logger.warn(killError, 'Error killing Python process during cleanup');
			}
		}

		return errorReturn('dataExplorer.errors.genericTryAgain');
	}
}

async function processRelationsRecursive(
	parentDocument: string,
	parentRecords: Record<string, unknown>[],
	relations: CrossModuleRelation[],
	user: User,
	authTokenId: string | undefined,
	allDatasets: Map<string, Record<string, unknown>[]>,
	warnings: CrossModuleWarning[],
	tracingSpan?: Span,
): Promise<RelationPythonConfig[]> {
	const limit = pLimit(RELATION_CONCURRENCY);

	const tasks = relations.map(relation =>
		limit(async () => {
			// Check relation access (Layer 2 - soft)
			const access = getAccessFor(relation.document, user);
			if (access === false) {
				warnings.push({
					type: 'RELATION_ACCESS_DENIED',
					document: relation.document,
					message: 'dataExplorer.warnings.relationNoReadAccess',
				});
				return null;
			}

			const resolution = resolveRelationLookup(parentDocument, relation);
			if (resolution == null) {
				warnings.push({
					type: 'MISSING_INDEX',
					document: relation.document,
					message: 'dataExplorer.warnings.relationLookupUnresolved',
				});
				return null;
			}

			// Extract parent IDs (handles isList arrays like staff._id)
			const parentIds = extractParentIds(parentRecords, resolution.parentKey);

			if (parentIds.length === 0) {
				return null;
			}

			// Build filter with $in + relation filter + readFilter
			const readFilter = typeof access === 'object' && access.readFilter ? access.readFilter : undefined;
			const mergedFilter = buildRelationFilter(parentIds, resolution, relation.filter, readFilter);

			// Augment relation fields to include the childKey field (needed for Python join)
			const childKeyTop = resolution.childKey.split('.')[0];
			let augmentedRelFields = relation.fields;
			if (augmentedRelFields != null && augmentedRelFields.trim() !== '') {
				const existingRelFields = augmentedRelFields.split(',').map(f => f.trim());
				if (!existingRelFields.includes(childKeyTop) && !existingRelFields.includes(resolution.childKey)) {
					augmentedRelFields = [...existingRelFields, childKeyTop].join(',');
				}
			}

			// Execute findStream for relation (Layers 2-6)
			tracingSpan?.addEvent(`findStream for relation ${relation.document}`);
			const relationStreamResult = await findStream({
				authTokenId,
				contextUser: user,
				document: relation.document,
				fields: augmentedRelFields,
				filter: mergedFilter,
				sort: relation.sort,
				limit: relation.limit,
				start: relation.start,
				getTotal: false,
				transformDatesToString: true,
				tracingSpan,
			});

			if (relationStreamResult.success === false) {
				logger.warn({ document: relation.document, errors: relationStreamResult.errors }, 'Relation findStream failed');
				return null;
			}

			const relationRecords = await collectStreamData(relationStreamResult.data);
			logger.debug({ document: relation.document, count: relationRecords.length }, 'Relation collected records');

			if (relationRecords.length > LARGE_DATASET_WARNING_THRESHOLD) {
				warnings.push({
					type: 'LARGE_DATASET',
					document: relation.document,
					message: 'dataExplorer.warnings.largeDataset',
				});
			}

			// Use unique dataset name for self-referential relations to avoid collision
			const datasetName = relation.document === parentDocument ? `${relation.document}:${relation.lookup}` : relation.document;

			// Tag and store
			const tagged = relationRecords.map(r => ({ ...r, [DATASET_TAG]: datasetName }));
			const existing = allDatasets.get(datasetName) ?? [];
			allDatasets.set(datasetName, [...existing, ...tagged]);

			// Normalize aggregator fields: child records use paths without relation prefix (e.g. email[0].address → email.address)
			const prefix = `${relation.lookup}.`;
			const aggregatorsForPython: RelationPythonConfig['aggregators'] = {};
			for (const [alias, cfg] of Object.entries(relation.aggregators)) {
				const field = cfg?.field?.startsWith(prefix) ? cfg.field.slice(prefix.length) : cfg?.field;
				aggregatorsForPython[alias] = { ...cfg, field };
			}

			// Build python config for this relation
			const pythonRelConfig: RelationPythonConfig = {
				dataset: datasetName,
				parentKey: resolution.parentKey,
				childKey: resolution.childKey,
				prefix: relation.lookup,
				aggregators: aggregatorsForPython,
			};

			// Process sub-relations recursively
			if (relation.relations != null && relation.relations.length > 0) {
				pythonRelConfig.relations = await processRelationsRecursive(
					relation.document,
					relationRecords,
					relation.relations,
					user,
					authTokenId,
					allDatasets,
					warnings,
					tracingSpan,
				);
			}

			return pythonRelConfig;
		}),
	);

	const results = await Promise.all(tasks);
	return results.filter((r): r is RelationPythonConfig => r != null);
}

async function collectStreamData(stream: Readable): Promise<Record<string, unknown>[]> {
	const records: Record<string, unknown>[] = [];

	return new Promise((resolve, reject) => {
		let buffer = '';

		stream.on('data', (chunk: Buffer | string) => {
			buffer += chunk.toString();
			const lines = buffer.split(NEWLINE_SEPARATOR);
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (line.trim()) {
					try {
						records.push(JSON.parse(line));
					} catch {
						logger.warn({ line: line.substring(0, 100) }, 'Failed to parse JSON line from stream');
					}
				}
			}
		});

		stream.on('end', () => {
			if (buffer.trim()) {
				try {
					records.push(JSON.parse(buffer));
				} catch {
					logger.warn({ buffer: buffer.substring(0, 100) }, 'Failed to parse final buffer');
				}
			}
			resolve(records);
		});

		stream.on('error', reject);
	});
}

async function sendRPC(pythonProcess: ChildProcess, config: CrossModulePythonConfig): Promise<void> {
	return new Promise((resolve, reject) => {
		if (pythonProcess.stdin == null) {
			reject(new Error('Python process stdin is not available'));
			return;
		}

		const request: CrossModuleRPCRequest = {
			jsonrpc: '2.0',
			method: 'aggregate',
			params: { config },
		};

		const requestLine = JSON.stringify(request) + NEWLINE_SEPARATOR;

		pythonProcess.stdin.write(requestLine, (error?: Error | null) => {
			if (error != null) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

async function sendDatasets(pythonProcess: ChildProcess, datasets: Map<string, Record<string, unknown>[]>): Promise<void> {
	return new Promise((resolve, reject) => {
		if (pythonProcess.stdin == null) {
			reject(new Error('Python process stdin is not available'));
			return;
		}

		for (const [, records] of datasets) {
			for (const record of records) {
				pythonProcess.stdin.write(JSON.stringify(record) + NEWLINE_SEPARATOR);
			}
		}

		pythonProcess.stdin.end();
		resolve();
	});
}

async function collectPythonResults(pythonProcess: ChildProcess): Promise<Record<string, unknown>[]> {
	return new Promise((resolve, reject) => {
		if (pythonProcess.stdout == null) {
			reject(new Error('Python process stdout is not available'));
			return;
		}

		let buffer = '';
		let rpcResponseRead = false;
		const results: Record<string, unknown>[] = [];

		pythonProcess.stdout.on('data', (data: Buffer) => {
			buffer += data.toString();
			const lines = buffer.split(NEWLINE_SEPARATOR);
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (!line.trim()) continue;

				if (!rpcResponseRead) {
					try {
						const rpcResponse = JSON.parse(line.trim());
						if (rpcResponse.error != null) {
							reject(new Error(`Python RPC error: ${rpcResponse.error.message}`));
							return;
						}
						rpcResponseRead = true;
						continue;
					} catch (error) {
						reject(new Error(`Failed to parse RPC response: ${(error as Error).message}`));
						return;
					}
				}

				try {
					results.push(JSON.parse(line));
				} catch {
					logger.warn({ line: line.substring(0, 100) }, 'Failed to parse Python result line');
				}
			}
		});

		pythonProcess.stdout.on('end', () => {
			if (buffer.trim()) {
				if (!rpcResponseRead) {
					try {
						const rpcResponse = JSON.parse(buffer.trim());
						if (rpcResponse.error != null) {
							reject(new Error(`Python RPC error: ${rpcResponse.error.message}`));
							return;
						}
						rpcResponseRead = true;
					} catch {
						reject(new Error('RPC response not received from Python process'));
						return;
					}
				} else {
					try {
						results.push(JSON.parse(buffer.trim()));
					} catch {
						logger.warn({ buffer: buffer.substring(0, 100) }, 'Failed to parse final Python buffer');
					}
				}
			}

			if (!rpcResponseRead) {
				reject(new Error('RPC response not received from Python process'));
				return;
			}

			resolve(results);
		});

		pythonProcess.stdout.on('error', (error: Error) => reject(error));
		pythonProcess.on('error', (error: Error) => reject(error));

		pythonProcess.on('exit', (code: number | null, signal: string | null) => {
			if (code !== 0 && code != null) {
				reject(new Error(`Python process exited with code ${code}`));
			} else if (signal != null) {
				reject(new Error(`Python process exited with signal ${signal}`));
			}
		});
	});
}

function buildMeta(query: CrossModuleQuery, warnings: CrossModuleWarning[], executionTimeMs: number): CrossModuleMeta {
	const relationsDocuments = extractRelationDocuments(query.relations);
	return {
		document: query.document,
		relations: relationsDocuments,
		warnings,
		executionTimeMs,
	};
}

function extractRelationDocuments(relations: CrossModuleRelation[]): string[] {
	return relations.flatMap(rel => [rel.document, ...(rel.relations != null ? extractRelationDocuments(rel.relations) : [])]);
}

/**
 * Augment the user-specified fields with extra top-level fields required by
 * groupBy, root aggregators, and relation parentKeys (e.g. isList lookups).
 * Always injects `_id` so the primary record can be referenced.
 */
export function buildAugmentedFields(query: CrossModuleQuery): string | undefined {
	if (query.fields == null || query.fields.trim() === '') {
		return undefined;
	}

	const relationPrefixes = new Set(query.relations.map(r => r.lookup));
	const extraFields = new Set<string>(['_id']);

	for (const field of query.groupBy) {
		const top = field.split('.')[0];
		if (!relationPrefixes.has(top)) {
			extraFields.add(top);
		}
	}

	for (const agg of Object.values(query.aggregators)) {
		if (agg.field != null) {
			const top = agg.field.split('.')[0];
			if (!relationPrefixes.has(top)) {
				extraFields.add(top);
			}
		}
	}

	for (const relation of query.relations) {
		const resolution = resolveRelationLookup(query.document, relation);
		if (resolution != null && resolution.parentKey !== '_id') {
			extraFields.add(resolution.parentKey.split('.')[0]);
		}
	}

	const existingFields = query.fields.split(',').map(f => f.trim());
	const merged = [...new Set([...existingFields, ...extraFields])];
	return merged.join(',');
}

/**
 * Extract parent IDs from records, handling both simple `_id` keys and
 * dot-notation keys that traverse arrays (e.g. `staff._id` where `staff`
 * is an isList lookup array).
 */
export function extractParentIds(parentRecords: Record<string, unknown>[], parentKey: string): string[] {
	if (parentKey === '_id') {
		const ids = parentRecords.map(r => r._id as string).filter((id): id is string => id != null);
		return [...new Set(ids)];
	}

	const dotIdx = parentKey.indexOf('.');
	if (dotIdx === -1) {
		const ids = parentRecords.map(r => r[parentKey] as string).filter((id): id is string => id != null);
		return [...new Set(ids)];
	}

	const fieldName = parentKey.slice(0, dotIdx);
	const subField = parentKey.slice(dotIdx + 1);

	const ids = parentRecords.flatMap(r => {
		const val = r[fieldName];
		if (Array.isArray(val)) {
			return val.map((item: unknown) => (item as Record<string, unknown>)?.[subField] as string);
		}
		if (val != null && typeof val === 'object') {
			return [(val as Record<string, unknown>)[subField] as string];
		}
		return [];
	});

	return [...new Set(ids.filter((id): id is string => id != null))];
}
