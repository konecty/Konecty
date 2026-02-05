// Helper functions for stream tests
import {
	BENCHMARK_ITERATION_CONCURRENCY,
	CONFIDENCE_TEST_CONCURRENCY,
	MEMORY_MONITOR_INTERVAL_MS,
} from '../../../src/imports/data/api/streamConstants';

export async function readStreamRecords(reader: ReadableStreamDefaultReader): Promise<any[]> {
	const decoder = new TextDecoder();
	const bufferState = { value: '' };
	const records: any[] = [];

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		if (value) {
			bufferState.value += decoder.decode(value, { stream: true });
			const lines = bufferState.value.split('\n');
			bufferState.value = lines.pop() || '';

			const parsedRecords = lines
				.filter(line => line.trim())
				.map(line => {
					try {
						return JSON.parse(line);
					} catch {
						return null;
					}
				})
				.filter((record): record is any => record !== null);

			records.push(...parsedRecords);
		}
	}

	// Process any remaining buffer
	if (bufferState.value.trim()) {
		try {
			const record = JSON.parse(bufferState.value.trim());
			records.push(record);
		} catch {
			// Ignore incomplete JSON
		}
	}

	return records;
}

export async function countStreamChunks(reader: ReadableStreamDefaultReader): Promise<number> {
	const chunkState = { count: 0 };

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		if (value) {
			chunkState.count++;
		}
	}

	return chunkState.count;
}

export async function readStreamRecordsWithMetrics(reader: ReadableStreamDefaultReader, startMemory: NodeJS.MemoryUsage): Promise<{ recordCount: number; peakMemory: number }> {
	const decoder = new TextDecoder();
	const bufferState = { value: '' };
	const recordState = { count: 0 };
	const memoryState = { peakMemory: startMemory.heapUsed };

	// Monitor memory during streaming
	const memoryInterval = setInterval(() => {
		const currentMemory = process.memoryUsage();
		memoryState.peakMemory = Math.max(memoryState.peakMemory, currentMemory.heapUsed);
	}, MEMORY_MONITOR_INTERVAL_MS);

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		if (value) {
			bufferState.value += decoder.decode(value, { stream: true });
			const lines = bufferState.value.split('\n');
			bufferState.value = lines.pop() || '';

			const parsedCount = lines
				.filter(line => line.trim())
				.map(line => {
					try {
						JSON.parse(line);
						return 1;
					} catch {
						return 0;
					}
				})
				.reduce((sum, count) => sum + count, 0);

			recordState.count += parsedCount;
		}
	}

	clearInterval(memoryInterval);

	return { recordCount: recordState.count, peakMemory: memoryState.peakMemory - startMemory.heapUsed };
}

export function calculateAverageMetrics<T extends Record<string, number>>(metricsArray: T[]): T {
	if (metricsArray.length === 0) {
		throw new Error('Cannot calculate average of empty array');
	}

	const keys = Object.keys(metricsArray[0]) as Array<keyof T>;

	return keys.reduce<T>((acc, key) => {
		const sum = metricsArray.reduce((sum, metric) => sum + (metric[key] as number), 0);
		acc[key] = (sum / metricsArray.length) as T[keyof T];
		return acc;
	}, {} as T);
}

export { BENCHMARK_ITERATION_CONCURRENCY, CONFIDENCE_TEST_CONCURRENCY };

