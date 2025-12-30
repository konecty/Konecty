import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'node:stream';
import { logger } from '@imports/utils/logger';
import { RPCRequest, RPCResponse, PivotEnrichedConfig } from '@imports/types/pivot';
import { NEWLINE_SEPARATOR } from './streamConstants';
import path from 'node:path';

const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'src', 'scripts', 'python', 'pivot_table.py');
const PYTHON_SCRIPT_PATH_DOCKER = path.join('/app', 'scripts', 'python', 'pivot_table.py');

/**
 * Creates a Python process using uv to run the pivot table script
 * @param scriptPath Optional path to the script (defaults to detected path)
 * @returns ChildProcess instance
 */
export function createPythonProcess(scriptPath?: string): ChildProcess {
	const script = scriptPath ?? (process.env.NODE_ENV === 'production' ? PYTHON_SCRIPT_PATH_DOCKER : PYTHON_SCRIPT_PATH);

	const pythonProcess = spawn('uv', ['run', '--script', script], {
		stdio: ['pipe', 'pipe', 'pipe'],
	});

	pythonProcess.on('error', (error: Error) => {
		logger.error(error, 'Error spawning Python process');
	});

	pythonProcess.stderr?.on('data', (data: Buffer) => {
		logger.warn({ stderr: data.toString() }, 'Python process stderr');
	});

	return pythonProcess;
}

/**
 * Sends an RPC request to Python process stdin (first line)
 * @param pythonProcess Python child process
 * @param method RPC method name
 * @param params RPC parameters (must contain config: PivotEnrichedConfig)
 */
export async function sendRPCRequest(pythonProcess: ChildProcess, method: string, params: { config: PivotEnrichedConfig }): Promise<void> {
	return new Promise((resolve, reject) => {
		if (pythonProcess.stdin == null) {
			reject(new Error('Python process stdin is not available'));
			return;
		}

		const request: RPCRequest = {
			jsonrpc: '2.0',
			method,
			params,
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

/**
 * Streams NDJSON data to Python process stdin (after RPC request)
 * @param nodeStream Readable stream with NDJSON data
 * @param pythonProcess Python child process
 */
export async function streamToPython(nodeStream: Readable, pythonProcess: ChildProcess): Promise<void> {
	return new Promise((resolve, reject) => {
		if (pythonProcess.stdin == null) {
			reject(new Error('Python process stdin is not available'));
			return;
		}

		nodeStream.on('data', (chunk: Buffer) => {
			if (pythonProcess.stdin != null) {
				pythonProcess.stdin.write(chunk);
			}
		});

		nodeStream.on('end', () => {
			if (pythonProcess.stdin != null) {
				pythonProcess.stdin.end();
			}
			resolve();
		});

		nodeStream.on('error', (error: Error) => {
			reject(error);
		});

		pythonProcess.on('error', (error: Error) => {
			reject(error);
		});
	});
}

/**
 * Parses RPC response from first line of Python stdout
 * @param firstLine First line from Python stdout
 * @returns Parsed RPC response
 */
export function parseRPCResponse(firstLine: string): RPCResponse {
	try {
		return JSON.parse(firstLine.trim()) as RPCResponse;
	} catch (error) {
		throw new Error(`Failed to parse RPC response: ${(error as Error).message}`);
	}
}

/**
 * Collects hierarchical result data from Python stdout (after RPC response)
 * @param pythonProcess Python child process
 * @returns Promise resolving to hierarchical result object with data and grandTotals
 */
export async function collectResultFromPython(pythonProcess: ChildProcess): Promise<{ data: unknown[]; grandTotals: Record<string, unknown> }> {
	return new Promise((resolve, reject) => {
		if (pythonProcess.stdout == null) {
			reject(new Error('Python process stdout is not available'));
			return;
		}

		let buffer = '';
		let rpcResponseRead = false;
		let resultData: { data: unknown[]; grandTotals: Record<string, unknown> } | null = null;

		pythonProcess.stdout.on('data', (data: Buffer) => {
			buffer += data.toString();

			// Split by newlines
			const lines = buffer.split(NEWLINE_SEPARATOR);
			// Keep the last incomplete line in buffer
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (!line.trim()) {
					continue;
				}

				// First non-empty line is the RPC response
				if (!rpcResponseRead) {
					try {
						const rpcResponse = parseRPCResponse(line);
						if (rpcResponse.error != null) {
							reject(new Error(`RPC error: ${rpcResponse.error.message}`));
							return;
						}
						rpcResponseRead = true;
						continue;
					} catch (error) {
						reject(error);
						return;
					}
				}

				// Second line is the hierarchical result (single JSON object)
				if (resultData == null) {
					try {
						resultData = JSON.parse(line) as { data: unknown[]; grandTotals: Record<string, unknown> };
					} catch (error) {
						logger.warn({ line, error }, 'Failed to parse result as JSON');
					}
				}
			}
		});

		pythonProcess.stdout.on('end', () => {
			// Process any remaining buffer
			if (buffer.trim() && resultData == null) {
				try {
					resultData = JSON.parse(buffer.trim()) as { data: unknown[]; grandTotals: Record<string, unknown> };
				} catch (error) {
					logger.warn({ buffer, error }, 'Failed to parse final buffer as JSON');
				}
			}

			if (!rpcResponseRead) {
				reject(new Error('RPC response not received from Python process'));
				return;
			}

			if (resultData == null) {
				reject(new Error('Result data not received from Python process'));
				return;
			}

			resolve(resultData);
		});

		pythonProcess.stdout.on('error', (error: Error) => {
			reject(error);
		});

		pythonProcess.on('error', (error: Error) => {
			reject(error);
		});

		pythonProcess.on('exit', (code: number | null, signal: string | null) => {
			if (code !== 0 && code != null) {
				reject(new Error(`Python process exited with code ${code}`));
			} else if (signal != null) {
				reject(new Error(`Python process exited with signal ${signal}`));
			}
		});
	});
}
