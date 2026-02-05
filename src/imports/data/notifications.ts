import isString from 'lodash/isString';
import pick from 'lodash/pick';
import { EventEmitter } from 'events';

import { getUserSafe } from '@imports/auth/getUser';
import { db } from '@imports/database';
import { MetaObject } from '@imports/model/MetaObject';
import { DataDocument } from '@imports/types/data';
import { errorReturn, successReturn } from '@imports/utils/return';
import { logger } from '../utils/logger';
import { randomId } from '../utils/random';
import { User } from '@imports/model/User';

// Constants
const NOTIFICATION_TTL_DAYS = 90;
const MAX_NOTIFICATIONS_PER_PAGE = 50;
const DEFAULT_PAGE_SIZE = 20;

// Event emitter for real-time notifications (single server)
// For multi-server, this should be replaced with RabbitMQ pub/sub
export const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(1000); // Allow many concurrent connections

// Types
export type NotificationType = 'mention' | 'reply' | 'watch' | 'status_change';

export interface Notification {
	_id: string;
	userId: string;
	type: NotificationType;
	relatedModule: string;
	relatedDataId: string;
	relatedCommentId?: string;
	triggeredBy: {
		_id: string;
		name?: string;
	};
	message?: string;
	read: boolean;
	readAt?: Date;
	_createdAt: Date;
	metadata?: Record<string, any>;
}

type ListNotificationsParams = {
	authTokenId?: string;
	read?: boolean;
	page?: number;
	limit?: number;
};

type CreateNotificationParams = {
	userId: string;
	type: NotificationType;
	relatedModule: string;
	relatedDataId: string;
	relatedCommentId?: string;
	triggeredBy: User;
	message?: string;
	metadata?: Record<string, any>;
};

type MarkAsReadParams = {
	authTokenId?: string;
	notificationId: string;
};

type MarkAllAsReadParams = {
	authTokenId?: string;
};

type GetUnreadCountParams = {
	authTokenId?: string;
};

// Helper to get or create the Notification collection
const getNotificationCollection = () => {
	// Register Notification collection if not exists
	if (!MetaObject.Collections['Notification']) {
		MetaObject.Collections['Notification'] = db.collection('data.Notification') as typeof MetaObject.Collections[string];
	}
	return MetaObject.Collections['Notification'];
};

// Initialize indexes (called once at startup)
export const initNotificationIndexes = async () => {
	try {
		const collection = getNotificationCollection();
		if (!collection) {
			logger.warn('Notification collection not available for indexing');
			return;
		}

		// Create indexes
		await collection.createIndex(
			{ userId: 1, read: 1, _createdAt: -1 },
			{ name: 'notification_user_read_date' }
		);
		await collection.createIndex(
			{ relatedModule: 1, relatedDataId: 1 },
			{ name: 'notification_related' }
		);
		// TTL index for automatic cleanup
		await collection.createIndex(
			{ _createdAt: 1 },
			{ name: 'notification_ttl', expireAfterSeconds: NOTIFICATION_TTL_DAYS * 24 * 60 * 60 }
		);

		logger.info('Notification indexes created successfully');
	} catch (error) {
		logger.error(error, 'Failed to create notification indexes');
	}
};

/**
 * List notifications for the current user
 */
export async function listNotifications({ authTokenId, read, page = 1, limit = DEFAULT_PAGE_SIZE }: ListNotificationsParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const collection = getNotificationCollection();

	if (!collection) {
		return errorReturn('Notification collection not available');
	}

	const query: Record<string, any> = { userId: user._id };
	if (read !== undefined) {
		query.read = read;
	}

	const safeLimit = Math.min(Math.max(1, limit), MAX_NOTIFICATIONS_PER_PAGE);
	const skip = (Math.max(1, page) - 1) * safeLimit;

	try {
		const [notifications, total, unreadCount] = await Promise.all([
			collection
				.find(query)
				.sort({ _createdAt: -1 })
				.skip(skip)
				.limit(safeLimit)
				.toArray(),
			collection.countDocuments(query),
			collection.countDocuments({ userId: user._id, read: false }),
		]);

		return successReturn({
			data: notifications,
			total,
			unreadCount,
			page,
			pages: Math.ceil(total / safeLimit),
		});
	} catch (error) {
		logger.error(error, 'Failed to list notifications');
		return errorReturn('Failed to list notifications');
	}
}

/**
 * Get unread notification count for the current user
 */
export async function getUnreadCount({ authTokenId }: GetUnreadCountParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const collection = getNotificationCollection();

	if (!collection) {
		return errorReturn('Notification collection not available');
	}

	try {
		const count = await collection.countDocuments({ userId: user._id, read: false });
		return successReturn({ count });
	} catch (error) {
		logger.error(error, 'Failed to get unread count');
		return errorReturn('Failed to get unread count');
	}
}

/**
 * Mark a notification as read
 */
export async function markAsRead({ authTokenId, notificationId }: MarkAsReadParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const collection = getNotificationCollection();

	if (!collection) {
		return errorReturn('Notification collection not available');
	}

	if (!isString(notificationId)) {
		return errorReturn('Invalid notification ID');
	}

	try {
		const result = await collection.findOneAndUpdate(
			{ _id: notificationId, userId: user._id },
			{ $set: { read: true, readAt: new Date() } },
			{ returnDocument: 'after' }
		);

		if (!result) {
			return errorReturn('Notification not found');
		}

		return successReturn(result);
	} catch (error) {
		logger.error(error, 'Failed to mark notification as read');
		return errorReturn('Failed to mark notification as read');
	}
}

/**
 * Mark all notifications as read for the current user
 */
export async function markAllAsRead({ authTokenId }: MarkAllAsReadParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const collection = getNotificationCollection();

	if (!collection) {
		return errorReturn('Notification collection not available');
	}

	try {
		const result = await collection.updateMany(
			{ userId: user._id, read: false },
			{ $set: { read: true, readAt: new Date() } }
		);

		return successReturn({ count: result.modifiedCount });
	} catch (error) {
		logger.error(error, 'Failed to mark all notifications as read');
		return errorReturn('Failed to mark all notifications as read');
	}
}

/**
 * Create a notification (internal use)
 */
export async function createNotification(params: CreateNotificationParams): Promise<Notification | null> {
	const collection = getNotificationCollection();

	if (!collection) {
		logger.error('Notification collection not available');
		return null;
	}

	const notification: Notification = {
		_id: randomId(),
		userId: params.userId,
		type: params.type,
		relatedModule: params.relatedModule,
		relatedDataId: params.relatedDataId,
		relatedCommentId: params.relatedCommentId,
		triggeredBy: pick(params.triggeredBy, ['_id', 'name']) as { _id: string; name?: string },
		message: params.message,
		read: false,
		_createdAt: new Date(),
		metadata: params.metadata,
	};

	try {
		await collection.insertOne(notification as unknown as DataDocument);
		
		// Emit event for SSE listeners
		notificationEmitter.emit(`notification:${params.userId}`, notification);
		
		logger.debug(`Notification created for user ${params.userId}: ${params.type}`);
		return notification;
	} catch (error) {
		logger.error(error, 'Failed to create notification');
		return null;
	}
}

/**
 * Create notifications for a new comment
 * - Notifies mentioned users
 * - Notifies the record owner (if different from commenter)
 * - Notifies subscribers
 */
export async function createNotificationsForComment(
	comment: {
		_id: string;
		dataId: string;
		text: string;
		mentions?: string[];
		parentId?: string;
		_createdBy: { _id: string; name?: string };
	},
	context: {
		document: string;
		recordOwnerId?: string;
		subscribers?: string[];
		parentCommentAuthorId?: string;
	},
	triggeredBy: User,
) {
	const { document, recordOwnerId, subscribers = [], parentCommentAuthorId } = context;
	const notifiedUserIds = new Set<string>();

	// Don't notify the commenter
	notifiedUserIds.add(triggeredBy._id);

	// 1. Notify mentioned users
	if (comment.mentions && comment.mentions.length > 0) {
		for (const userId of comment.mentions) {
			if (notifiedUserIds.has(userId)) continue;
			notifiedUserIds.add(userId);

			await createNotification({
				userId,
				type: 'mention',
				relatedModule: document,
				relatedDataId: comment.dataId,
				relatedCommentId: comment._id,
				triggeredBy,
				message: `mentioned you in a comment`,
			});
		}
	}

	// 2. Notify parent comment author (for replies)
	if (comment.parentId && parentCommentAuthorId && !notifiedUserIds.has(parentCommentAuthorId)) {
		notifiedUserIds.add(parentCommentAuthorId);

		await createNotification({
			userId: parentCommentAuthorId,
			type: 'reply',
			relatedModule: document,
			relatedDataId: comment.dataId,
			relatedCommentId: comment._id,
			triggeredBy,
			message: `replied to your comment`,
		});
	}

	// 3. Notify record owner
	if (recordOwnerId && !notifiedUserIds.has(recordOwnerId)) {
		notifiedUserIds.add(recordOwnerId);

		await createNotification({
			userId: recordOwnerId,
			type: 'watch',
			relatedModule: document,
			relatedDataId: comment.dataId,
			relatedCommentId: comment._id,
			triggeredBy,
			message: `commented on your record`,
		});
	}

	// 4. Notify subscribers
	for (const subscriberId of subscribers) {
		if (notifiedUserIds.has(subscriberId)) continue;
		notifiedUserIds.add(subscriberId);

		await createNotification({
			userId: subscriberId,
			type: 'watch',
			relatedModule: document,
			relatedDataId: comment.dataId,
			relatedCommentId: comment._id,
			triggeredBy,
			message: `commented on a record you're watching`,
		});
	}

	return notifiedUserIds.size - 1; // Exclude the commenter
}
