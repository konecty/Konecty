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
			return errorReturn(`User lacks read access to primary document '${query.document}'`);
		}

		// Step 4: Execute primary findStream (Layers 2-6)
		tracingSpan?.addEvent('Executing primary findStream');
		const primaryStreamResult = await findStream({
			authTokenId,
			contextUser: user,
			document: query.document,
			fields: query.fields,
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

		const pythonConfig = await processRelationsRecursive(query.document, primaryRecords, query.relations, user, authTokenId, allDatasets, warnings, tracingSpan);

		if (primaryRecords.length === 0 && allDatasets.size <= 1) {
			return {
				success: true,
				meta: buildMeta(query, warnings, Date.now() - startTime),
				records: [],
				total: total ?? 0,
			};
		}

		// Step 7: Spawn Python process via uv (ADR-0006) and send data
		tracingSpan?.addEvent('Spawning Python process');
		const scriptPath = process.env.NODE_ENV === 'production' ? PYTHON_SCRIPT_PATH_DOCKER : PYTHON_SCRIPT_PATH;
		pythonProcess = createPythonProcess(scriptPath);

		const config: CrossModulePythonConfig = {
			parentDataset: query.document,
			relations: pythonConfig,
		};

		// Send RPC request
		await sendRPC(pythonProcess, config);

		// Send all datasets as tagged NDJSON
		tracingSpan?.addEvent('Sending data to Python');
		await sendDatasets(pythonProcess, allDatasets);

		// Step 8: Read results from Python
		tracingSpan?.addEvent('Collecting results from Python');
		const mergedRecords = await collectPythonResults(pythonProcess);

		if (total != null && total > CROSS_QUERY_MAX_RECORDS) {
			warnings.push({
				type: 'LIMIT_REACHED',
				message: `Result limited to ${CROSS_QUERY_MAX_RECORDS} of ${total} records`,
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

		return errorReturn('Oops something went wrong, please try again later... if this message persisits, please contact our support');
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
	const configs: RelationPythonConfig[] = [];

	const tasks = relations.map(relation =>
		limit(async () => {
			// Check relation access (Layer 2 - soft)
			const access = getAccessFor(relation.document, user);
			if (access === false) {
				warnings.push({
					type: 'RELATION_ACCESS_DENIED',
					document: relation.document,
					message: `User lacks read access to ${relation.document}`,
				});
				return null;
			}

			const resolution = resolveRelationLookup(parentDocument, relation);
			if (resolution == null) {
				warnings.push({
					type: 'MISSING_INDEX',
					document: relation.document,
					message: `Could not resolve lookup '${relation.lookup}' in '${relation.document}' for parent '${parentDocument}'`,
				});
				return null;
			}

			// Extract parent IDs
			const parentIds = parentRecords.map(r => r[resolution.parentKey] as string).filter((id): id is string => id != null);

			if (parentIds.length === 0) {
				return null;
			}

			// Build filter with $in + relation filter + readFilter
			const readFilter = typeof access === 'object' && access.readFilter ? access.readFilter : undefined;
			const mergedFilter = buildRelationFilter(parentIds, resolution, relation.filter, readFilter);

			// Execute findStream for relation (Layers 2-6)
			tracingSpan?.addEvent(`findStream for relation ${relation.document}`);
			const relationStreamResult = await findStream({
				authTokenId,
				contextUser: user,
				document: relation.document,
				fields: relation.fields,
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

			if (relationRecords.length > 50_000) {
				warnings.push({
					type: 'LARGE_DATASET',
					document: relation.document,
					message: `${relation.document} returned ${relationRecords.length} records`,
				});
			}

			// Tag and store
			const tagged = relationRecords.map(r => ({ ...r, [DATASET_TAG]: relation.document }));
			const existing = allDatasets.get(relation.document) ?? [];
			allDatasets.set(relation.document, [...existing, ...tagged]);

			// Build python config for this relation
			const pythonRelConfig: RelationPythonConfig = {
				dataset: relation.document,
				parentKey: resolution.parentKey,
				childKey: resolution.childKey,
				aggregators: relation.aggregators,
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
	for (const result of results) {
		if (result != null) {
			configs.push(result);
		}
	}

	return configs;
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
	const docs: string[] = [];
	for (const rel of relations) {
		docs.push(rel.document);
		if (rel.relations != null) {
			docs.push(...extractRelationDocuments(rel.relations));
		}
	}
	return docs;
}
