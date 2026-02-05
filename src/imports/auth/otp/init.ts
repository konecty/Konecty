import { Collection } from 'mongodb';
import { db } from '@imports/database';
import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';

const OTP_REQUEST_COLLECTION_NAME = 'otpRequests';
const OTP_REQUEST_COLLECTION_VERSION = 1; // Increment when schema changes

/**
 * Initialize OtpRequest collection and indexes
 * Should only be called when creating the first OTP
 */
export async function initializeOtpRequestCollection(): Promise<void> {
	// Check if already initialized
	const namespace = MetaObject.Namespace;
	const currentVersion = namespace.otpRequestCollectionVersion ?? 0;

	if (currentVersion >= OTP_REQUEST_COLLECTION_VERSION) {
		logger.debug('[OTP] OtpRequest collection already initialized');
		return;
	}

	logger.info(`[OTP] Initializing OtpRequest collection indexes (version ${OTP_REQUEST_COLLECTION_VERSION})`);

	const collection = db.collection(OTP_REQUEST_COLLECTION_NAME);

	// Create TTL index on expiresAt
	try {
		await collection.createIndex(
			{ expiresAt: 1 },
			{
				expireAfterSeconds: 0,
				name: 'otp_ttl_index',
			},
		);
		logger.debug('[OTP] Created TTL index on expiresAt');
	} catch (error) {
		if ((error as { code?: number }).code !== 85) {
			// 85 = IndexOptionsConflict, means index already exists
			logger.error(error, '[OTP] Error creating TTL index');
		}
	}

	// Create lookup index for phone number
	try {
		await collection.createIndex(
			{ 'user._id': 1, phoneNumber: 1, expiresAt: 1 },
			{
				name: 'otp_lookup_phone_index',
				partialFilterExpression: { phoneNumber: { $exists: true } },
			},
		);
		logger.debug('[OTP] Created lookup index for phone number');
	} catch (error) {
		if ((error as { code?: number }).code !== 85) {
			logger.error(error, '[OTP] Error creating lookup index for phone');
		}
	}

	// Create lookup index for email
	try {
		await collection.createIndex(
			{ 'user._id': 1, email: 1, expiresAt: 1 },
			{
				name: 'otp_lookup_email_index',
				partialFilterExpression: { email: { $exists: true } },
			},
		);
		logger.debug('[OTP] Created lookup index for email');
	} catch (error) {
		if ((error as { code?: number }).code !== 85) {
			logger.error(error, '[OTP] Error creating lookup index for email');
		}
	}

	// Create unique index to prevent multiple active OTPs per user/phone
	// OTPs are deleted after verification, so this ensures only one active OTP exists
	try {
		await collection.createIndex(
			{ 'user._id': 1, phoneNumber: 1 },
			{
				unique: true,
				partialFilterExpression: { phoneNumber: { $exists: true } },
				name: 'otp_unique_active_phone',
			},
		);
		logger.debug('[OTP] Created unique index for active OTPs by phone');
	} catch (error) {
		if ((error as { code?: number }).code !== 85) {
			logger.error(error, '[OTP] Error creating unique index for phone');
		}
	}

	// Create unique index to prevent multiple active OTPs per user/email
	try {
		await collection.createIndex(
			{ 'user._id': 1, email: 1 },
			{
				unique: true,
				partialFilterExpression: { email: { $exists: true } },
				name: 'otp_unique_active_email',
			},
		);
		logger.debug('[OTP] Created unique index for active OTPs by email');
	} catch (error) {
		if ((error as { code?: number }).code !== 85) {
			logger.error(error, '[OTP] Error creating unique index for email');
		}
	}

	// Update Namespace with version
	await MetaObject.MetaObject.updateOne(
		{ _id: 'Namespace' },
		{
			$set: {
				otpRequestCollectionVersion: OTP_REQUEST_COLLECTION_VERSION,
			},
		},
	);

	// Update in-memory Namespace
	namespace.otpRequestCollectionVersion = OTP_REQUEST_COLLECTION_VERSION;

	logger.info('[OTP] OtpRequest collection indexes initialized successfully');
}

/**
 * Get OtpRequest collection from MongoDB
 * Only registers in memory if not already cached
 */
export function getOtpRequestCollection(): Collection {
	// Return cached collection if available
	if (MetaObject.Collections.OtpRequest != null) {
		// @ts-expect-error - Collection type mismatch, Konecty uses string _id
		return MetaObject.Collections.OtpRequest;
	}

	// Get collection from MongoDB and cache it
	const collection = db.collection(OTP_REQUEST_COLLECTION_NAME);
	// @ts-expect-error - Collection type mismatch, Konecty uses string _id
	MetaObject.Collections.OtpRequest = collection;

	return collection;
}
