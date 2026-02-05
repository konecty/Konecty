import { hash as bcryptHash, compare as bcryptCompare } from 'bcryptjs';
import { randomId } from '@imports/utils/random';
import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { BCRYPT_SALT_ROUNDS, OTP_CODE_LENGTH, OTP_DEFAULT_EXPIRATION_MINUTES, OTP_MAX_VERIFICATION_ATTEMPTS, OTP_RATE_LIMIT_REQUESTS_PER_MINUTE } from '../../consts';
import { initializeOtpRequestCollection, getOtpRequestCollection } from './init';
import { client } from '@imports/database';
import { retryMongoTransaction } from '@imports/utils/transaction';

export interface OtpRequest extends Record<string, unknown> {
	_id?: string;
	phoneNumber?: string;
	email?: string;
	otpHash: string;
	user: { _id: string; name?: string; group?: { _id: string; name?: string } };
	attempts: number;
	expiresAt: Date;
	_createdAt: Date;
}

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTP(): string {
	const min = 100000; // 6-digit minimum
	const max = 999999; // 6-digit maximum
	const code = Math.floor(Math.random() * (max - min + 1)) + min;
	return code.toString().padStart(OTP_CODE_LENGTH, '0');
}

/**
 * Hash OTP code with bcrypt
 */
export async function hashOTP(otp: string): Promise<string> {
	return await bcryptHash(otp, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify OTP code against hash
 */
export async function verifyOTP(otp: string, hash: string): Promise<boolean> {
	return await bcryptCompare(otp, hash);
}

/**
 * Get OTP expiration time in minutes from Namespace config or use default
 */
function getExpirationMinutes(): number {
	const expirationMinutes = MetaObject.Namespace.otpConfig?.expirationMinutes;
	return expirationMinutes ?? OTP_DEFAULT_EXPIRATION_MINUTES;
}

/**
 * Create OTP request record and return OTP code for delivery
 * Returns both the OTP request record and the unhashed OTP code
 * Uses database transaction to enforce rate limiting and remove old OTPs atomically
 */
export async function createOtpRequest(userId: string, phoneNumber?: string, email?: string): Promise<{ otpRequest: OtpRequest; otpCode: string }> {
	if (phoneNumber == null && email == null) {
		throw new Error('Either phoneNumber or email must be provided');
	}

	const now = new Date();
	const oneMinuteAgo = new Date(now.getTime() - 60000);

	// Initialize collection and indexes on first OTP creation
	await initializeOtpRequestCollection();
	const collection = getOtpRequestCollection();

	// Fetch user to get name and group (outside transaction for efficiency)
	const user = (await MetaObject.Collections.User.findOne({ _id: userId }, { projection: { _id: 1, name: 1, group: 1 } })) as Pick<User, '_id' | 'name' | 'group'> | null;

	if (user == null) {
		throw new Error(`User not found: ${userId}`);
	}

	// Use transaction to ensure atomicity: check rate limit, remove old OTPs, and create new OTP
	const result = await retryMongoTransaction(async () => {
		const session = client.startSession();

		try {
			return await session.withTransaction(async () => {
				// Build query to find OTPs for this identifier in the last minute
				const rateLimitQuery: Record<string, unknown> = {
					'user._id': userId,
					_createdAt: { $gte: oneMinuteAgo },
				};

				if (phoneNumber != null) {
					rateLimitQuery.phoneNumber = phoneNumber;
				} else {
					rateLimitQuery.email = email;
				}

				// Count OTP requests in the last minute for rate limiting
				const recentRequestsCount = await collection.countDocuments(rateLimitQuery, { session });

				if (recentRequestsCount >= OTP_RATE_LIMIT_REQUESTS_PER_MINUTE) {
					throw new Error('Rate limit exceeded. Too many OTP requests in the last minute.');
				}

				// Remove all previous OTPs for this identifier (not just expired ones)
				// This ensures only one active OTP exists per identifier
				const deleteQuery: Record<string, unknown> = {
					'user._id': userId,
				};

				if (phoneNumber != null) {
					deleteQuery.phoneNumber = phoneNumber;
				} else {
					deleteQuery.email = email;
				}

				await collection.deleteMany(deleteQuery, { session });

				// Generate new OTP
				const otpCode = generateOTP();
				const otpHash = await hashOTP(otpCode);
				const expirationMinutes = getExpirationMinutes();
				const expiresAt = new Date(now.getTime() + expirationMinutes * 60 * 1000);

				const otpRequest: OtpRequest = {
					_id: randomId(),
					...(phoneNumber != null && { phoneNumber }),
					...(email != null && { email }),
					otpHash,
					user: {
						_id: user._id,
						name: user.name,
						group: user.group,
					},
					attempts: 0,
					expiresAt,
					_createdAt: now,
				};

				// Insert new OTP request
				// @ts-expect-error - MongoDB accepts string _id from Konecty
				await collection.insertOne(otpRequest, { session });

				return { otpRequest, otpCode };
			});
		} finally {
			await session.endSession();
		}
	});

	return result;
}

/**
 * Find valid (non-expired) OTP request by phone number or email
 */
export async function findValidOtpRequest(userId: string, phoneNumber?: string, email?: string): Promise<OtpRequest | null> {
	if (phoneNumber == null && email == null) {
		return null;
	}

	const now = new Date();
	const collection = getOtpRequestCollection();

	const query: Record<string, unknown> = {
		'user._id': userId,
		expiresAt: { $gt: now },
	};

	if (phoneNumber != null) {
		query.phoneNumber = phoneNumber;
	}
	if (email != null) {
		query.email = email;
	}

	const otpRequest = (await collection.findOne(query)) as OtpRequest | null;

	return otpRequest;
}

/**
 * Increment attempts counter for OTP request
 */
export async function incrementAttempts(otpRequestId: string): Promise<void> {
	const collection = getOtpRequestCollection();
	await collection.updateOne(
		// @ts-expect-error - MongoDB accepts string _id from Konecty
		{ _id: otpRequestId },
		{
			$inc: { attempts: 1 },
		},
	);
}

/**
 * Remove OTP request after successful verification
 * OTPs are one-time use, so we delete immediately after verification
 */
export async function removeOtpRequest(otpRequestId: string): Promise<void> {
	const collection = getOtpRequestCollection();
	await collection.deleteOne(
		// @ts-expect-error - MongoDB accepts string _id from Konecty
		{ _id: otpRequestId },
	);
}

/**
 * Check if OTP request has exceeded max attempts
 */
export function hasExceededMaxAttempts(otpRequest: OtpRequest): boolean {
	return otpRequest.attempts >= OTP_MAX_VERIFICATION_ATTEMPTS;
}
