import { ChildProcess } from 'child_process';
import { Readable } from 'node:stream';
import path from 'node:path';

import { logger } from '@imports/utils/logger';
import find from './find';
import findStream from './findStream';
import { createPythonProcess, sendRPCRequest, collectResultFromPython } from './pythonStreamBridge';
import { KonectyResultError } from '@imports/types/result';
import { errorReturn } from '@imports/utils/return';
import { BuildFindQueryParams } from './findUtils';
import { NEWLINE_SEPARATOR } from './streamConstants';

/**
 * KPI Stream Processing
 * Aggregates data for KPI widgets following the same pattern as pivotStream.ts:
 *   buildFindQuery → findStream (field permissions) → Python (Polars) aggregation
 *
 * For 'count': uses find() with getTotal:true, limit:1 (no Python needed).
 * For sum/avg/min/max/percentage: streams through Python kpi_aggregator.py.
 *
 * ADR-0012: no-magic-numbers, prefer-const, functional style
 */

// --- Constants (ADR-0012: no-magic-numbers) ---
const KPI_MAX_RECORDS_DEFAULT = 100_000;
const COUNT_LIMIT = 1;
const COUNT_FIELDS = '_id';

const PYTHON_KPI_SCRIPT_PATH = path.join(process.cwd(), 'src', 'scripts', 'python', 'kpi_aggregator.py');
const PYTHON_KPI_SCRIPT_PATH_DOCKER = path.join('/app', 'scripts', 'python', 'kpi_aggregator.py');

// --- Types ---

export interface KpiConfig {
	operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
	field?: string; // required for all except count
}

export type KpiStreamParams = BuildFindQueryParams & {
	kpiConfig: KpiConfig;
	tracingSpan?: import('@opentelemetry/api').Span;
};

export interface KpiStreamResult {
	success: true;
	value: number;
	count: number;
	validCount?: number;
}

// --- Helpers ---

/**
 * Creates a Python process for KPI aggregation
 */
const createKpiPythonProcess = (): ChildProcess => {
	const scriptPath = process.env.NODE_ENV === 'production' ? PYTHON_KPI_SCRIPT_PATH_DOCKER : PYTHON_KPI_SCRIPT_PATH;
	return createPythonProcess(scriptPath);
};

/**
 * Collect NDJSON data from the stream into an array.
 * Simplified version of pivotStream's collectAndPopulateData — no lookup population needed
 * since KPI aggregates only numeric fields.
 */
const collectDataFromStream = async (stream: Readable): Promise<Record<string, unknown>[]> => {
	const documents: Record<string, unknown>[] = [];

	await new Promise<void>((resolve, reject) => {
		let buffer = '';

		stream.on('data', (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split(NEWLINE_SEPARATOR);
			buffer = lines.pop() ?? '';

			lines
				.filter((line) => line.trim().length > 0)
				.forEach((line) => {
					try {
						documents.push(JSON.parse(line));
					} catch {
						logger.warn({ line: line.substring(0, 100) }, 'KPI stream: failed to parse JSON line');
					}
				});
		});

		stream.on('end', () => {
			if (buffer.trim()) {
				try {
					documents.push(JSON.parse(buffer));
				} catch {
					logger.warn({ buffer: buffer.substring(0, 100) }, 'KPI stream: failed to parse final buffer');
				}
			}
			resolve();
		});

		stream.on('error', reject);
	});

	return documents;
};

/**
 * Send collected documents to the Python process via stdin as NDJSON.
 */
const sendDataToPython = async (pythonProcess: ChildProcess, documents: Record<string, unknown>[]): Promise<void> => {
	return new Promise((resolve, reject) => {
		if (pythonProcess.stdin == null) {
			reject(new Error('Python process stdin is not available'));
			return;
		}

		documents.forEach((doc) => {
			pythonProcess.stdin!.write(JSON.stringify(doc) + NEWLINE_SEPARATOR);
		});

		pythonProcess.stdin.end();
		resolve();
	});
};

// --- Main function ---

/**
 * Executes a KPI aggregation following the pivotStream/graphStream pattern.
 *
 * Count: uses find() with getTotal:true (fast, no Python needed).
 * Sum/avg/min/max: findStream → field permissions → Python/Polars.
 * Percentage is handled client-side via two parallel calls (no backend support needed).
 */
export default async function kpiStream({
	kpiConfig,
	tracingSpan,
	...findParams
}: KpiStreamParams): Promise<KpiStreamResult | KonectyResultError> {
	let pythonProcess: ChildProcess | null = null;

	try {
		tracingSpan?.addEvent('Starting KPI stream processing');
		const { operation, field } = kpiConfig;

		// --- COUNT: use find() directly, no Python ---
		if (operation === 'count') {
			tracingSpan?.addEvent('KPI count: using find() with getTotal');

			const result = await find({
				authTokenId: findParams.authTokenId,
				document: findParams.document,
				displayName: findParams.displayName,
				displayType: findParams.displayType,
				fields: COUNT_FIELDS,
				filter: findParams.filter,
				sort: findParams.sort,
				limit: COUNT_LIMIT,
				start: 0,
				withDetailFields: undefined,
				getTotal: true,
				tracingSpan,
			} as any);

			if (result.success === false) {
				return result;
			}

			const total = (result as any).total ?? 0;
			tracingSpan?.addEvent('KPI count completed', { total: String(total) });

			return {
				success: true,
				value: total,
				count: total,
			};
		}

		// --- SUM/AVG/MIN/MAX: findStream → Python ---

		// Validate field is present
		if (field == null || field.length === 0) {
			return errorReturn(`KPI aggregation '${operation}' requires a field`);
		}

		// Build fields for projection: only the field we need
		const projectionFields = [field];

		// Merge with existing fields if any
		const existingFields = findParams.fields ? findParams.fields.split(',').map((f) => f.trim()) : [];
		const allFields = [...new Set([...existingFields, ...projectionFields])];

		logger.info(`KPI fields for MongoDB projection: ${allFields.join(', ')}`);

		// Get configurable limit
		const KPI_MAX_RECORDS = parseInt(process.env.KPI_MAX_RECORDS ?? String(KPI_MAX_RECORDS_DEFAULT), 10);

		tracingSpan?.addEvent('Calling findStream for KPI data');

		const streamResult = await findStream({
			...findParams,
			fields: allFields.join(','),
			limit: KPI_MAX_RECORDS,
			getTotal: true,
			transformDatesToString: false, // Keep native types for numeric aggregation
			tracingSpan,
		});

		if (streamResult.success === false) {
			return streamResult;
		}

		const { data: mongoStream, total } = streamResult;

		logger.info(`KPI total records from findStream: ${total ?? 'unknown'}`);

		// Collect data from stream
		tracingSpan?.addEvent('Collecting KPI data from stream');
		const startCollect = Date.now();
		const documents = await collectDataFromStream(mongoStream);
		const collectTime = Date.now() - startCollect;
		logger.info(`KPI collected ${documents.length} documents in ${collectTime}ms`);

		if (documents.length === 0) {
			return {
				success: true,
				value: 0,
				count: 0,
				validCount: 0,
			};
		}

		// Create Python process
		tracingSpan?.addEvent('Creating Python KPI process');
		pythonProcess = createKpiPythonProcess();

		// Send RPC request with KPI config
		tracingSpan?.addEvent('Sending RPC request to Python');
		await sendRPCRequest(pythonProcess, 'aggregate', {
			config: { operation, field },
		} as any);

		// Send data to Python
		tracingSpan?.addEvent('Sending data to Python');
		logger.info(`Sending ${documents.length} documents to Python for KPI aggregation...`);
		const startPython = Date.now();
		await sendDataToPython(pythonProcess, documents);

		// Collect result from Python
		tracingSpan?.addEvent('Collecting result from Python');
		const pythonResult = await collectResultFromPython(pythonProcess);
		const pythonTime = Date.now() - startPython;
		logger.info(`Python KPI aggregation completed in ${pythonTime}ms`);

		// Extract numeric result from Python output
		// pythonResult.data is the result array, but for KPI it's a single object
		const resultData = Array.isArray(pythonResult.data) ? pythonResult.data[0] : pythonResult.data;
		const kpiResult = (resultData ?? pythonResult) as Record<string, unknown>;

		const value = typeof kpiResult.result === 'number' ? kpiResult.result : 0;
		const count = typeof kpiResult.count === 'number' ? kpiResult.count : documents.length;
		const validCount = typeof kpiResult.validCount === 'number' ? kpiResult.validCount : undefined;

		tracingSpan?.addEvent('KPI processing completed', {
			value: String(value),
			count: String(count),
		});

		return {
			success: true,
			value,
			count,
			...(validCount != null ? { validCount } : {}),
		};
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);
		logger.error(error, `Error executing kpiStream: ${error.message}`);

		// Cleanup: kill Python process if still running
		if (pythonProcess != null && !pythonProcess.killed) {
			try {
				pythonProcess.kill();
			} catch (killError) {
				logger.warn(killError, 'Error killing Python process during KPI cleanup');
			}
		}

		return errorReturn('Oops something went wrong, please try again later... if this message persists, please contact our support');
	}
}
