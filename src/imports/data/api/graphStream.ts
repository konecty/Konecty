import { ChildProcess } from 'child_process';
import { logger } from '@imports/utils/logger';
import findStream from './findStream';
import { createGraphPythonProcess, sendGraphRPCRequest, streamToPython, collectSVGFromPython } from './pythonStreamBridge';
import { GraphStreamParams, GraphStreamResult, GraphConfig } from '@imports/types/graph';
import { KonectyResultError } from '@imports/types/result';
import { errorReturn } from '@imports/utils/return';

export default async function graphStream({
	graphConfig,
	transformDatesToString = true,
	tracingSpan,
	...findParams
}: GraphStreamParams): Promise<GraphStreamResult | KonectyResultError> {
	let pythonProcess: ChildProcess | null = null;

	try {
		tracingSpan?.addEvent('Starting graph stream processing');

		// 1. Validate graphConfig
		if (graphConfig == null) {
			tracingSpan?.end();
			return errorReturn('graphConfig is required');
		}

		if (!graphConfig.type) {
			tracingSpan?.end();
			return errorReturn('graphConfig.type is required');
		}

		// 2. Call findStream to get MongoDB data stream (internal streaming)
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

		// 3. Create Python process with uv run
		tracingSpan?.addEvent('Creating Python process');
		pythonProcess = createGraphPythonProcess();

		// 4. Send RPC request with graph config to Python stdin (first line)
		tracingSpan?.addEvent('Sending RPC request to Python');
		await sendGraphRPCRequest(pythonProcess, 'graph', { config: graphConfig });

		// 5. Pipe MongoDB stream to Python stdin (NDJSON format, after RPC request)
		tracingSpan?.addEvent('Streaming data to Python');
		await streamToPython(mongoStream, pythonProcess);

		// 6. Read RPC response from Python stdout (first line) and collect SVG content
		tracingSpan?.addEvent('Collecting SVG from Python');
		const svg = await collectSVGFromPython(pythonProcess);

		// 7. Return SVG string
		tracingSpan?.addEvent('Graph processing completed', {
			svgLength: String(svg.length),
		});

		const result: GraphStreamResult = {
			success: true,
			svg,
		};

		if (total != null) {
			result.total = total;
		}

		return result;
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);
		logger.error(error, `Error executing graphStream: ${error.message}`);

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

