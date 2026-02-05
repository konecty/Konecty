import { 
	createNotification, 
	createNotificationsForComment,
	notificationEmitter 
} from '../../src/imports/data/notifications';

// Mock MetaObject
const mockInsertOne = jest.fn();
const mockCollection = {
	insertOne: mockInsertOne,
};

jest.mock('../../src/imports/model/MetaObject', () => ({
	MetaObject: {
		Collections: {
			User: {
				s: {
					db: {
						collection: jest.fn(() => mockCollection),
					},
				},
			},
			Notification: null, // Will be created dynamically
		},
	},
}));

// Mock logger
jest.mock('../../src/imports/utils/logger', () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
	},
}));

// Mock randomId
jest.mock('../../src/imports/utils/random', () => ({
	randomId: jest.fn(() => 'generated-id'),
}));

import { MetaObject } from '../../src/imports/model/MetaObject';

describe('Notifications', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockInsertOne.mockReset();
		// Set up the collection
		(MetaObject.Collections as any).Notification = mockCollection;
	});

	describe('createNotification', () => {
		const mockTriggeredBy = {
			_id: 'trigger-user',
			name: 'Trigger User',
			active: true,
		};

		it('creates a notification and emits event', async () => {
			mockInsertOne.mockResolvedValueOnce({ acknowledged: true });

			const emitSpy = jest.spyOn(notificationEmitter, 'emit');

			const notification = await createNotification({
				userId: 'user-1',
				type: 'mention',
				relatedModule: 'Document',
				relatedDataId: 'data-1',
				relatedCommentId: 'comment-1',
				triggeredBy: mockTriggeredBy as any,
				message: 'mentioned you',
			});

			expect(notification).not.toBeNull();
			expect(notification?._id).toBe('generated-id');
			expect(notification?.userId).toBe('user-1');
			expect(notification?.type).toBe('mention');
			expect(notification?.read).toBe(false);

			expect(mockInsertOne).toHaveBeenCalled();
			expect(emitSpy).toHaveBeenCalledWith(
				'notification:user-1',
				expect.objectContaining({ userId: 'user-1' })
			);

			emitSpy.mockRestore();
		});

		it('returns null on insert error', async () => {
			mockInsertOne.mockRejectedValueOnce(new Error('DB Error'));

			const notification = await createNotification({
				userId: 'user-1',
				type: 'mention',
				relatedModule: 'Document',
				relatedDataId: 'data-1',
				triggeredBy: mockTriggeredBy as any,
			});

			expect(notification).toBeNull();
		});

		it('returns null if collection is not available', async () => {
			(MetaObject.Collections as any).Notification = null;
			(MetaObject.Collections.User as any).s = undefined;

			const notification = await createNotification({
				userId: 'user-1',
				type: 'mention',
				relatedModule: 'Document',
				relatedDataId: 'data-1',
				triggeredBy: mockTriggeredBy as any,
			});

			expect(notification).toBeNull();
		});
	});

	describe('createNotificationsForComment', () => {
		const mockComment = {
			_id: 'comment-1',
			dataId: 'data-1',
			text: 'Test comment @john',
			_createdBy: { _id: 'commenter-id', name: 'Commenter' },
		};

		const mockTriggeredBy = {
			_id: 'commenter-id',
			name: 'Commenter',
			active: true,
		};

		beforeEach(() => {
			// Reset collection
			(MetaObject.Collections as any).Notification = mockCollection;
			mockInsertOne.mockResolvedValue({ acknowledged: true });
		});

		it('notifies mentioned users', async () => {
			const commentWithMentions = {
				...mockComment,
				mentions: ['user-mentioned'],
			};

			const count = await createNotificationsForComment(
				commentWithMentions,
				{ document: 'Document' },
				mockTriggeredBy as any
			);

			expect(mockInsertOne).toHaveBeenCalledTimes(1);
			expect(mockInsertOne).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'user-mentioned',
					type: 'mention',
				})
			);
		});

		it('notifies parent comment author for replies', async () => {
			const replyComment = {
				...mockComment,
				parentId: 'parent-comment',
			};

			await createNotificationsForComment(
				replyComment,
				{ 
					document: 'Document',
					parentCommentAuthorId: 'parent-author',
				},
				mockTriggeredBy as any
			);

			expect(mockInsertOne).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'parent-author',
					type: 'reply',
				})
			);
		});

		it('notifies record owner', async () => {
			await createNotificationsForComment(
				mockComment,
				{ 
					document: 'Document',
					recordOwnerId: 'owner-id',
				},
				mockTriggeredBy as any
			);

			expect(mockInsertOne).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'owner-id',
					type: 'watch',
				})
			);
		});

		it('notifies subscribers', async () => {
			await createNotificationsForComment(
				mockComment,
				{ 
					document: 'Document',
					subscribers: ['subscriber-1', 'subscriber-2'],
				},
				mockTriggeredBy as any
			);

			expect(mockInsertOne).toHaveBeenCalledTimes(2);
		});

		it('does not notify the commenter', async () => {
			await createNotificationsForComment(
				{ ...mockComment, mentions: ['commenter-id'] },
				{ 
					document: 'Document',
					recordOwnerId: 'commenter-id',
					subscribers: ['commenter-id'],
				},
				mockTriggeredBy as any
			);

			// Should not create any notifications
			expect(mockInsertOne).not.toHaveBeenCalled();
		});

		it('deduplicates notifications', async () => {
			const commentWithMentions = {
				...mockComment,
				mentions: ['same-user'],
			};

			await createNotificationsForComment(
				commentWithMentions,
				{ 
					document: 'Document',
					recordOwnerId: 'same-user', // Same user is owner
					subscribers: ['same-user'], // And subscriber
				},
				mockTriggeredBy as any
			);

			// Should only create 1 notification (mention takes priority)
			expect(mockInsertOne).toHaveBeenCalledTimes(1);
			expect(mockInsertOne).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'mention' })
			);
		});
	});
});
