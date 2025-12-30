import { ChildProcess } from 'child_process';
import { logger } from '@imports/utils/logger';
import findStream from './findStream';
import { createPythonProcess, sendRPCRequest, streamToPython, collectResultFromPython } from './pythonStreamBridge';
import { enrichPivotConfig } from './pivotMetadata';
import { PivotStreamParams, PivotEnrichedResult } from '@imports/types/pivot';
import { KonectyResultError } from '@imports/types/result';
import { errorReturn } from '@imports/utils/return';

export default async function pivotStream({
	pivotConfig,
	transformDatesToString = true,
	tracingSpan,
	lang = 'pt_BR',
	...findParams
}: PivotStreamParams): Promise<PivotEnrichedResult | KonectyResultError> {
	let pythonProcess: ChildProcess | null = null;

	try {
		tracingSpan?.addEvent('Starting pivot stream processing');

		// 0. Enrich pivot config with metadata
		tracingSpan?.addEvent('Enriching pivot config with metadata');
		const enrichedConfig = enrichPivotConfig(findParams.document, pivotConfig, lang);

		// 1. Call findStream to get MongoDB data stream (internal streaming)
		tracingSpan?.addEvent('Calling findStream to get data');
		const streamResult = await findStream({
			...findParams,
			transformDatesToString,
			tracingSpan,
		});

		if (streamResult.success === false) {
			return streamResult;
		}

		const { data: mongoStream, total } = streamResult;

		// 2. Create Python process with uv run
		tracingSpan?.addEvent('Creating Python process');
		pythonProcess = createPythonProcess();

		// 3. Send RPC request with enriched pivot config to Python stdin (first line)
		tracingSpan?.addEvent('Sending RPC request to Python');
		await sendRPCRequest(pythonProcess, 'pivot', { config: enrichedConfig });

		// 4. Pipe MongoDB stream to Python stdin (NDJSON format, after RPC request)
		tracingSpan?.addEvent('Streaming data to Python');
		await streamToPython(mongoStream, pythonProcess);

		// 5. Read RPC response from Python stdout (first line) and collect hierarchical result
		tracingSpan?.addEvent('Collecting result from Python');
		const { data: hierarchyData, grandTotals } = await collectResultFromPython(pythonProcess);

		// 6. Return enriched result with metadata and hierarchical structure
		tracingSpan?.addEvent('Pivot processing completed', {
			rowCount: String(hierarchyData.length),
		});

		const result: PivotEnrichedResult = {
			success: true,
			metadata: {
				rows: enrichedConfig.rows,
				columns: enrichedConfig.columns,
				values: enrichedConfig.values,
			},
			data: hierarchyData as PivotEnrichedResult['data'],
			grandTotals: grandTotals as unknown as PivotEnrichedResult['grandTotals'],
		};

		if (total != null) {
			result.total = total;
		}

		return result;
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);
		logger.error(error, `Error executing pivotStream: ${error.message}`);

		// Cleanup: kill Python process if it's still running
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
