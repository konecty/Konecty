import { handleTransactionError, retryMongoTransaction } from '../../src/imports/utils/transaction';

jest.mock('../../src/imports/utils/logger', () => ({
	logger: {
		debug: jest.fn(),
		trace: jest.fn(),
	},
}));

type MockMongoError = Error & {
	type: string;
	codeName?: string;
	hasErrorLabel: (label: string) => boolean;
};

function createMongoLikeError({ message, codeName, labels = [] }: { message: string; codeName?: string; labels?: string[] }): MockMongoError {
	const error = new Error(message) as MockMongoError;
	error.type = 'MongoServerError';
	error.codeName = codeName;
	error.hasErrorLabel = (label: string) => labels.includes(label);
	return error;
}

describe('transaction utils', () => {
	let setTimeoutSpy: jest.SpyInstance;

	beforeEach(() => {
		setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((callback: Parameters<typeof setTimeout>[0]) => {
			if (typeof callback === 'function') {
				callback();
			}
			return 0 as unknown as NodeJS.Timeout;
		}) as typeof setTimeout);
	});

	afterEach(() => {
		setTimeoutSpy.mockRestore();
		jest.clearAllMocks();
	});

	it('retries when error code is NoSuchTransaction', async () => {
		const retryableError = createMongoLikeError({
			message: 'Transaction aborted',
			codeName: 'NoSuchTransaction',
		});
		let attempts = 0;

		const result = await retryMongoTransaction(async () => {
			attempts += 1;
			if (attempts === 1) {
				throw retryableError;
			}
			return 'ok';
		}, 2);

		expect(result).toBe('ok');
		expect(attempts).toBe(2);
	});

	it('retries when transient transaction label is present', async () => {
		const retryableError = createMongoLikeError({
			message: 'Transient transaction error',
			labels: ['TransientTransactionError'],
		});
		let attempts = 0;

		const result = await retryMongoTransaction(async () => {
			attempts += 1;
			if (attempts === 1) {
				throw retryableError;
			}
			return 'ok';
		}, 2);

		expect(result).toBe('ok');
		expect(attempts).toBe(2);
	});

	it('does not retry non-retryable errors', async () => {
		const nonRetryableError = new Error('Validation failed');
		let attempts = 0;

		await expect(
			retryMongoTransaction(async () => {
				attempts += 1;
				throw nonRetryableError;
			}, 2),
		).rejects.toThrow('Validation failed');

		expect(attempts).toBe(1);
	});

	it('aborts and rethrows retryable transaction errors', async () => {
		const retryableError = createMongoLikeError({
			message: 'Transaction aborted',
			codeName: 'NoSuchTransaction',
		});
		const abortTransaction = jest.fn().mockResolvedValue(undefined);
		const session = { abortTransaction } as any;

		await expect(handleTransactionError(retryableError, session)).rejects.toBe(retryableError);
		expect(abortTransaction).toHaveBeenCalledTimes(1);
	});

	it('aborts session and ignores non-retryable errors', async () => {
		const abortTransaction = jest.fn().mockResolvedValue(undefined);
		const session = { abortTransaction } as any;
		const error = new Error('Any non transaction error');

		await expect(handleTransactionError(error, session)).resolves.toBeUndefined();
		expect(abortTransaction).toHaveBeenCalledTimes(1);
	});
});
