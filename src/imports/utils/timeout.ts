export async function withTimeout<T>(promise: Promise<T> | (() => Promise<T>), timeout: number, operationName: string): Promise<T> {
	if (typeof promise === 'function') {
		promise = promise();
	}
	const result = await Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${operationName} timed out after ${timeout}ms`)), timeout))]);
	return result as T;
}
