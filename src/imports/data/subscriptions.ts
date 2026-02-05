import isString from 'lodash/isString';

import { getUserSafe } from '@imports/auth/getUser';
import { db } from '@imports/database';
import { MetaObject } from '@imports/model/MetaObject';
import { errorReturn, successReturn } from '@imports/utils/return';
import { getAccessFor } from '../utils/accessUtils';
import { logger } from '../utils/logger';
import { randomId } from '../utils/random';

// Types
export interface Subscription {
	_id: string;
	userId: string;
	module: string;
	dataId: string;
	_createdAt: Date;
}

type SubscribeParams = {
	authTokenId?: string;
	module: string;
	dataId: string;
};

type UnsubscribeParams = SubscribeParams;

type GetSubscriptionStatusParams = SubscribeParams;

type ListSubscribersParams = {
	module: string;
	dataId: string;
};

// Helper to get or create the NotificationSubscription collection
const getSubscriptionCollection = () => {
	if (!MetaObject.Collections['NotificationSubscription']) {
		MetaObject.Collections['NotificationSubscription'] = db.collection('data.NotificationSubscription') as typeof MetaObject.Collections[string];
	}
	return MetaObject.Collections['NotificationSubscription'];
};

// Initialize indexes (called once at startup)
export const initSubscriptionIndexes = async () => {
	try {
		const collection = getSubscriptionCollection();
		if (!collection) {
			logger.warn('NotificationSubscription collection not available for indexing');
			return;
		}

		// Create unique compound index
		await collection.createIndex(
			{ userId: 1, module: 1, dataId: 1 },
			{ name: 'subscription_unique', unique: true }
		);
		
		// Index for listing subscribers
		await collection.createIndex(
			{ module: 1, dataId: 1 },
			{ name: 'subscription_record' }
		);

		logger.info('NotificationSubscription indexes created successfully');
	} catch (error) {
		logger.error(error, 'Failed to create subscription indexes');
	}
};

/**
 * Subscribe to notifications for a record
 */
export async function subscribe({ authTokenId, module, dataId }: SubscribeParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const access = getAccessFor(module, user);

	if (access === false) {
		return errorReturn(`[${module}] You don't have permission for this document`);
	}

	const documentCollection = MetaObject.Collections[module];
	if (documentCollection == null) {
		return errorReturn(`[${module}] Document collection not found`);
	}

	if (!isString(dataId)) {
		return errorReturn(`[${module}] Param dataId must be a valid string id`);
	}

	// Verify record exists
	const record = await documentCollection.findOne({ _id: dataId });
	if (record == null) {
		return errorReturn(`[${module}] Record not found using id ${dataId}`);
	}

	const collection = getSubscriptionCollection();
	if (!collection) {
		return errorReturn('Subscription collection not available');
	}

	try {
		// Use upsert to avoid duplicates
		await collection.updateOne(
			{ userId: user._id, module, dataId },
			{
				$setOnInsert: {
					_id: randomId(),
					userId: user._id,
					module,
					dataId,
					_createdAt: new Date(),
				},
			},
			{ upsert: true }
		);

		return successReturn({ subscribed: true });
	} catch (error) {
		logger.error(error, 'Failed to subscribe');
		return errorReturn('Failed to subscribe');
	}
}

/**
 * Unsubscribe from notifications for a record
 */
export async function unsubscribe({ authTokenId, module, dataId }: UnsubscribeParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;

	if (!isString(module) || !isString(dataId)) {
		return errorReturn('Invalid module or dataId');
	}

	const collection = getSubscriptionCollection();
	if (!collection) {
		return errorReturn('Subscription collection not available');
	}

	try {
		await collection.deleteOne({ userId: user._id, module, dataId });
		return successReturn({ subscribed: false });
	} catch (error) {
		logger.error(error, 'Failed to unsubscribe');
		return errorReturn('Failed to unsubscribe');
	}
}

/**
 * Get subscription status for current user and a record
 */
export async function getSubscriptionStatus({ authTokenId, module, dataId }: GetSubscriptionStatusParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;

	if (!isString(module) || !isString(dataId)) {
		return errorReturn('Invalid module or dataId');
	}

	const collection = getSubscriptionCollection();
	if (!collection) {
		return errorReturn('Subscription collection not available');
	}

	try {
		const subscription = await collection.findOne({ userId: user._id, module, dataId });
		return successReturn({ subscribed: subscription != null });
	} catch (error) {
		logger.error(error, 'Failed to get subscription status');
		return errorReturn('Failed to get subscription status');
	}
}

/**
 * List all subscribers for a record (internal use)
 */
export async function listSubscribers({ module, dataId }: ListSubscribersParams): Promise<string[]> {
	const collection = getSubscriptionCollection();
	if (!collection) {
		return [];
	}

	try {
		const subscriptions = await collection
			.find({ module, dataId }, { projection: { userId: 1 } })
			.toArray();

		return subscriptions.map(sub => sub.userId as string);
	} catch (error) {
		logger.error(error, 'Failed to list subscribers');
		return [];
	}
}
