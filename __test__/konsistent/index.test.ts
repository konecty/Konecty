// Test wrapHistoryError indirectly through processChangeSync behavior

const mockCreateHistory = jest.fn();
const mockProcessIncomingChange = jest.fn();

jest.mock('../../src/imports/utils/logger', () => ({
	logger: {
		debug: jest.fn(),
		trace: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
	},
}));

jest.mock('../../src/imports/konsistent/createHistory', () => ({
	__esModule: true,
	default: mockCreateHistory,
}));

jest.mock('../../src/imports/konsistent/processIncomingChange', () => ({
	__esModule: true,
	default: mockProcessIncomingChange,
}));

jest.mock('../../src/imports/model/MetaObject', () => ({
	MetaObject: {
		Namespace: {
			plan: {
				useExternalKonsistent: false,
			},
		},
	},
}));

type MockMongoError = Error & {
	type: string;
	code?: number;
	codeName?: string;
	hasErrorLabel: (label: string) => boolean;
};

function createMongoLikeError({
	message,
	codeName,
	code,
	labels = [],
}: {
	message: string;
	codeName?: string;
	code?: number;
	labels?: string[];
}): MockMongoError {
	const error = new Error(message) as MockMongoError;
	error.type = 'MongoServerError';
	error.codeName = codeName;
	error.code = code;
	error.hasErrorLabel = (label: string) => labels.includes(label);
	return error;
}

describe('Konsistent error handling', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should preserve MongoDB error metadata when wrapping createHistory errors', async () => {
		const { Konsistent } = await import('../../src/imports/konsistent/index');

		const originalError = createMongoLikeError({
			message: 'Transaction aborted',
			codeName: 'NoSuchTransaction',
			code: 251,
			labels: ['TransientTransactionError'],
		});

		mockCreateHistory.mockRejectedValue(originalError);

		try {
			await Konsistent.processChangeSync(
				'TestMeta',
				'update',
				{ _id: 'user1', name: 'Test User' },
				{
					newRecord: {
						_id: 'rec1',
						name: 'New Name',
						_createdAt: new Date(),
						_createdBy: {},
						_updatedAt: new Date(),
						_updatedBy: {},
					},
				},
			);
			fail('Should have thrown an error');
		} catch (error) {
			const wrappedError = error as MockMongoError;

			// Verify error message includes context
			expect(wrappedError.message).toContain('Error creating history');
			expect(wrappedError.message).toContain('Transaction aborted');

			// Verify MongoDB metadata is preserved
			expect(wrappedError.type).toBe('MongoServerError');
			expect(wrappedError.codeName).toBe('NoSuchTransaction');
			expect(wrappedError.code).toBe(251);
			expect(wrappedError.hasErrorLabel('TransientTransactionError')).toBe(true);
		}
	});

	it('should wrap regular errors without MongoDB metadata', async () => {
		const { Konsistent } = await import('../../src/imports/konsistent/index');

		const regularError = new Error('Something went wrong');
		mockCreateHistory.mockRejectedValue(regularError);

		try {
			await Konsistent.processChangeSync(
				'TestMeta',
				'update',
				{ _id: 'user1', name: 'Test User' },
				{
					newRecord: {
						_id: 'rec1',
						name: 'New Name',
						_createdAt: new Date(),
						_createdBy: {},
						_updatedAt: new Date(),
						_updatedBy: {},
					},
				},
			);
			fail('Should have thrown an error');
		} catch (error) {
			const wrappedError = error as Error;

			expect(wrappedError.message).toContain('Error creating history');
			expect(wrappedError.message).toContain('Something went wrong');
		}
	});

	it('should handle errors without message gracefully', async () => {
		const { Konsistent } = await import('../../src/imports/konsistent/index');

		const noMessageError = new Error();
		mockCreateHistory.mockRejectedValue(noMessageError);

		try {
			await Konsistent.processChangeSync(
				'TestMeta',
				'update',
				{ _id: 'user1', name: 'Test User' },
				{
					newRecord: {
						_id: 'rec1',
						name: 'New Name',
						_createdAt: new Date(),
						_createdBy: {},
						_updatedAt: new Date(),
						_updatedBy: {},
					},
				},
			);
			fail('Should have thrown an error');
		} catch (error) {
			const wrappedError = error as Error;

			expect(wrappedError.message).toContain('Error creating history');
		}
	});
});
