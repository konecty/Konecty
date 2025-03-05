import { KonectyResult, KonectyResultError } from '@imports/types/result';

type ErrorObject = {
	errors?: string[] | string;
	reason?: string;
	message?: string;
};

/**
 * Extracts error messages from KonectyResults that failed
 * @param results Array of KonectyResults to process
 * @returns Array of error messages
 */
export function extractErrorsFromResults<T>(results: KonectyResult<T>[]): string[] {
	return results
		.filter(result => result.success === false)
		.flatMap(_result => {
			const result = _result as unknown as ErrorObject;
			return result.errors ?? result.reason ?? result.message ?? [];
		});
}

export function hasKonectyError(result: KonectyResult<any> | KonectyResult<any>[]): result is KonectyResultError[] {
	if (Array.isArray(result)) {
		return result.some(r => r.success === false);
	}

	return result.success === false;
}
