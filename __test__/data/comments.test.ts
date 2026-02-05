import { extractMentions, resolveMentions, validateMentions } from '../../src/imports/data/comments';

// Mock MetaObject
jest.mock('../../src/imports/model/MetaObject', () => ({
	MetaObject: {
		Collections: {
			User: {
				find: jest.fn(),
				findOne: jest.fn(),
			},
		},
	},
}));

// Mock getAccessFor
jest.mock('../../src/imports/utils/accessUtils', () => ({
	getAccessFor: jest.fn(),
}));

import { MetaObject } from '../../src/imports/model/MetaObject';
import { getAccessFor } from '../../src/imports/utils/accessUtils';

describe('Comment Mentions', () => {
	describe('extractMentions', () => {
		it('extracts single mention', () => {
			const text = 'Hello @john, how are you?';
			const mentions = extractMentions(text);
			expect(mentions).toEqual(['john']);
		});

		it('extracts multiple mentions', () => {
			const text = 'Hey @john and @jane, check this out @admin';
			const mentions = extractMentions(text);
			expect(mentions).toEqual(['john', 'jane', 'admin']);
		});

		it('deduplicates mentions', () => {
			const text = '@john said hello, and @john said goodbye';
			const mentions = extractMentions(text);
			expect(mentions).toEqual(['john']);
		});

		it('returns empty array for no mentions', () => {
			const text = 'No mentions here at all';
			const mentions = extractMentions(text);
			expect(mentions).toEqual([]);
		});

		it('handles empty string', () => {
			const mentions = extractMentions('');
			expect(mentions).toEqual([]);
		});

		it('handles mentions with dots and dashes', () => {
			const text = '@john.doe and @jane-doe mentioned';
			const mentions = extractMentions(text);
			expect(mentions).toEqual(['john.doe', 'jane-doe']);
		});

		it('handles mentions at start and end of text', () => {
			const text = '@start mentioning @end';
			const mentions = extractMentions(text);
			expect(mentions).toEqual(['start', 'end']);
		});

		it('returns empty array for non-string input', () => {
			const mentions = extractMentions(null as any);
			expect(mentions).toEqual([]);
		});
	});

	describe('resolveMentions', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('returns empty array for empty usernames', async () => {
			const result = await resolveMentions([]);
			expect(result).toEqual([]);
		});

		it('resolves usernames to user objects', async () => {
			const mockUsers = [
				{ _id: 'user-1', name: 'John Doe', username: 'john' },
				{ _id: 'user-2', name: 'Jane Doe', username: 'jane' },
			];

			(MetaObject.Collections.User.find as jest.Mock).mockReturnValue({
				toArray: () => Promise.resolve(mockUsers),
			});

			const result = await resolveMentions(['john', 'jane']);

			expect(result).toHaveLength(2);
			expect(result[0]._id).toBe('user-1');
			expect(result[1]._id).toBe('user-2');
		});

		it('returns empty array if User collection is not available', async () => {
			const originalCollection = MetaObject.Collections.User;
			(MetaObject.Collections as any).User = null;

			const result = await resolveMentions(['john']);
			expect(result).toEqual([]);

			MetaObject.Collections.User = originalCollection;
		});
	});

	describe('validateMentions', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('returns empty array for empty mentions', async () => {
			const result = await validateMentions([], 'Document', 'data-1');
			expect(result).toEqual([]);
		});

		it('filters out users without access to document', async () => {
			const mentionedUsers = [
				{ _id: 'user-1', name: 'John' },
				{ _id: 'user-2', name: 'Jane' },
			];

			(MetaObject.Collections.User.findOne as jest.Mock)
				.mockResolvedValueOnce({ _id: 'user-1', active: true })
				.mockResolvedValueOnce({ _id: 'user-2', active: true });

			// user-1 has access, user-2 doesn't
			(getAccessFor as jest.Mock)
				.mockReturnValueOnce({ readAccess: true })
				.mockReturnValueOnce(false);

			const result = await validateMentions(mentionedUsers, 'Document', 'data-1');

			expect(result).toEqual(['user-1']);
		});

		it('skips users not found in database', async () => {
			const mentionedUsers = [
				{ _id: 'user-1', name: 'John' },
				{ _id: 'user-not-found', name: 'Ghost' },
			];

			(MetaObject.Collections.User.findOne as jest.Mock)
				.mockResolvedValueOnce({ _id: 'user-1', active: true })
				.mockResolvedValueOnce(null);

			(getAccessFor as jest.Mock).mockReturnValue({ readAccess: true });

			const result = await validateMentions(mentionedUsers, 'Document', 'data-1');

			expect(result).toEqual(['user-1']);
		});
	});
});
