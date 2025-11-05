import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { StatusCodes } from 'http-status-codes';
import isString from 'lodash/isString';
import { UAParser } from 'ua-parser-js';
import get from 'lodash/get';
import BluebirdPromise from 'bluebird';

import { generateStampedLoginToken } from '@imports/auth/login/token';
import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { DataDocument } from '@imports/types/data';
import { logger } from '@imports/utils/logger';
import { createOtpRequest, findValidOtpRequest, incrementAttempts, removeOtpRequest, verifyOTP, hasExceededMaxAttempts, OtpRequest } from '@imports/auth/otp';
import { randomId } from '@imports/utils/random';
import { sendOtp } from '@imports/auth/otp/delivery';
import { cleanupSessions } from '@imports/auth/login';
import { OTP_COUNTRY_CODE_SEARCH_CONCURRENCY } from '@imports/consts';

/**
 * Validate E.164 phone number format
 */
function validateE164PhoneNumber(phoneNumber: string): boolean {
	// E.164 format: +[country code][number] (e.g., +5511999999999)
	const e164Pattern = /^\+[1-9]\d{1,14}$/;
	return e164Pattern.test(phoneNumber);
}

/**
 * Extract and normalize IP address from request headers
 * Checks x-forwarded-for first, then x-real-ip, then connection remoteAddress
 */
function extractIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string | undefined {
	// Try x-forwarded-for first (for proxied requests)
	const forwardedFor = req.headers['x-forwarded-for'];
	if (isString(forwardedFor)) {
		return forwardedFor.replace(/\s/g, '').split(',')[0];
	}

	// Try x-real-ip (alternative proxy header)
	const realIp = req.headers['x-real-ip'];
	if (isString(realIp)) {
		return realIp.replace(/\s/g, '');
	}

	// Fallback to socket remoteAddress
	if (req.socket?.remoteAddress != null) {
		return req.socket.remoteAddress;
	}

	return undefined;
}

/**
 * Find user by email address
 */
async function findUserByEmail(email: string): Promise<User | null> {
	const user = (await MetaObject.Collections.User.findOne({
		active: true,
		'emails.address': email,
	})) as User | null;

	return user;
}

/**
 * Find user by phone number (any phone in User.phone array)
 * Phone number can match by E.164 format (+5511999999999) or by countryCode + phoneNumber
 */
async function findUserByPhone(phoneNumber: string): Promise<User | null> {
	// Normalize phone number (remove + and spaces for comparison)
	const normalizedPhone = phoneNumber.replace(/[+\s]/g, '');

	// Try to find user by matching phoneNumber field directly
	const user = (await MetaObject.Collections.User.findOne({
		active: true,
		phone: {
			$elemMatch: {
				phoneNumber: { $regex: new RegExp(normalizedPhone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
			},
		},
	})) as User | null;

	// If not found, try matching by countryCode + phoneNumber combination (E.164 format)
	if (user != null || normalizedPhone.length <= 2) {
		return user;
	}

	// Extract potential country code (first 1-3 digits) and phone number
	const possibleCountryCodes = [normalizedPhone.substring(0, 1), normalizedPhone.substring(0, 2), normalizedPhone.substring(0, 3)];
	const possiblePhoneNumbers = possibleCountryCodes.map(cc => normalizedPhone.substring(cc.length));

	// Find first matching user by country code + phone number
	const countryCodeMatches = await BluebirdPromise.map(
		possibleCountryCodes,
		async (cc, index) => {
			const countryCode = parseInt(cc, 10);
			const phoneNum = possiblePhoneNumbers[index];

			if (isNaN(countryCode) || phoneNum.length === 0) {
				return null;
			}

			return (await MetaObject.Collections.User.findOne({
				active: true,
				phone: {
					$elemMatch: {
						countryCode: countryCode,
						phoneNumber: phoneNum,
					},
				},
			})) as User | null;
		},
		{ concurrency: OTP_COUNTRY_CODE_SEARCH_CONCURRENCY },
	);

	return countryCodeMatches.find(match => match != null) ?? null;
}

const otpApi: FastifyPluginCallback = (fastify, _, done) => {
	/**
	 * Request OTP endpoint
	 * POST /api/auth/request-otp
	 * Accepts either phoneNumber or email
	 * Optional: geolocation, resolution, source, fingerprint
	 */
	fastify.post<{
		Body: {
			phoneNumber?: string;
			email?: string;
			geolocation?: { longitude: number; latitude: number } | string;
			resolution?: { width: number; height: number } | string;
			source?: string;
			fingerprint?: string;
		};
	}>('/api/auth/request-otp', async function (req, reply) {
		const { phoneNumber, email, geolocation, resolution, source, fingerprint } = req.body;

		// Validate that exactly one of phoneNumber or email is provided
		if ((phoneNumber == null && email == null) || (phoneNumber != null && email != null)) {
			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Either phoneNumber or email must be provided (but not both)' }],
			});
		}

		// Validate phone number format if provided
		if (phoneNumber != null && (!isString(phoneNumber) || !validateE164PhoneNumber(phoneNumber))) {
			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Invalid phone number format. Must be in E.164 format (e.g., +5511999999999)' }],
			});
		}

		// Validate email format if provided
		if (email != null && (!isString(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Invalid email format' }],
			});
		}

		// Use phoneNumber or email for identifier
		const identifier = phoneNumber ?? email!;

		// Find user by phone number or email
		const user = phoneNumber != null ? await findUserByPhone(phoneNumber) : await findUserByEmail(email!);
		if (user == null) {
			const userAgent = req.headers['user-agent'];
			const ua = new UAParser(userAgent ?? 'API Call').getResult();
			const ip = extractIp(req);

			const accessLog = {
				_id: randomId(),
				_createdAt: new Date(),
				_updatedAt: new Date(),
				ip,
				login: identifier,
				browser: ua.browser.name,
				browserVersion: ua.browser.version,
				os: ua.os.name,
				platform: ua.device.type,
				reason: `User not found for ${phoneNumber != null ? `phone number [${phoneNumber}]` : `email [${email}]`}`,
				__from: 'request-otp',
			};

			await MetaObject.Collections.AccessFailedLog.insertOne(accessLog as DataDocument);

			return reply.status(StatusCodes.NOT_FOUND).send({
				success: false,
				errors: [{ message: phoneNumber != null ? 'User not found for this phone number' : 'User not found for this email' }],
			});
		}

		// Create OTP request (rate limiting is handled inside createOtpRequest via database transaction)
		const getOtpResult = async (): Promise<{ otpRequest: OtpRequest; otpCode: string }> => {
			try {
				return await createOtpRequest(user._id, phoneNumber, email);
			} catch (error) {
				const errorMessage = (error as Error).message;
				if (errorMessage.includes('Rate limit exceeded')) {
					return reply.status(StatusCodes.TOO_MANY_REQUESTS).send({
						success: false,
						errors: [{ message: 'Too many requests. Please try again later.' }],
					}) as never;
				}
				throw error;
			}
		};

		const { otpRequest, otpCode } = await getOtpResult();

		// Send OTP via delivery service
		// If requested by email, send directly via email (skip WhatsApp)
		const deliveryResult = await sendOtp(phoneNumber, email, otpCode, user._id, otpRequest.expiresAt);

		if (!deliveryResult.success) {
			logger.error(`Failed to send OTP: ${deliveryResult.error}`);
			return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
				success: false,
				errors: [{ message: 'Failed to send OTP. Please try again later.' }],
			});
		}

		return reply.send({
			success: true,
			message: `OTP sent via ${deliveryResult.method}`,
		});
	});

	/**
	 * Verify OTP endpoint
	 * POST /api/auth/verify-otp
	 * Accepts either phoneNumber or email
	 * Optional: geolocation, resolution, source, fingerprint
	 */
	fastify.post<{
		Body: {
			phoneNumber?: string;
			email?: string;
			otpCode: string;
			geolocation?: { longitude: number; latitude: number } | string;
			resolution?: { width: number; height: number } | string;
			source?: string;
			fingerprint?: string;
		};
	}>('/api/auth/verify-otp', async function (req, reply) {
		const { phoneNumber, email, otpCode, geolocation, resolution, source, fingerprint } = req.body;

		// Validate that exactly one of phoneNumber or email is provided
		if ((phoneNumber == null && email == null) || (phoneNumber != null && email != null)) {
			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Either phoneNumber or email must be provided (but not both)' }],
			});
		}

		// Validate phone number format if provided
		if (phoneNumber != null && (!isString(phoneNumber) || !validateE164PhoneNumber(phoneNumber))) {
			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Invalid phone number format. Must be in E.164 format (e.g., +5511999999999)' }],
			});
		}

		// Validate email format if provided
		if (email != null && (!isString(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Invalid email format' }],
			});
		}

		if (!isString(otpCode) || !/^\d{6}$/.test(otpCode)) {
			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Invalid OTP code format. Must be 6 digits' }],
			});
		}

		// Use phoneNumber or email for identifier
		const identifier = phoneNumber ?? email!;

		// Find user
		const user = phoneNumber != null ? await findUserByPhone(phoneNumber) : await findUserByEmail(email!);
		if (user == null) {
			const userAgent = req.headers['user-agent'];
			const ua = new UAParser(userAgent ?? 'API Call').getResult();
			const ip = extractIp(req);

			const accessLog: Record<string, unknown> = {
				_id: randomId(),
				_createdAt: new Date(),
				_updatedAt: new Date(),
				ip,
				login: identifier,
				browser: ua.browser.name,
				browserVersion: ua.browser.version,
				browserEngine: ua.engine.name,
				browserEngineVersion: ua.engine.version,
				os: ua.os.name,
				platform: ua.device.type,
				...(source != null && { source }),
				...(fingerprint != null && { fingerprint }),
				reason: `User not found for ${phoneNumber != null ? `phone number [${phoneNumber}]` : `email [${email}]`}`,
				__from: 'verify-otp',
			};

			// Process resolution if provided
			if (resolution != null) {
				if (typeof resolution === 'string') {
					accessLog.resolution = JSON.parse(resolution);
				} else {
					accessLog.resolution = resolution;
				}
			}

			// Process geolocation if provided
			if (geolocation != null) {
				if (typeof geolocation === 'string') {
					const { lng, lat } = JSON.parse(geolocation);
					accessLog.geolocation = [lng, lat];
				} else {
					const { longitude, latitude } = geolocation;
					accessLog.geolocation = [longitude, latitude];
				}
			}

			await MetaObject.Collections.AccessFailedLog.insertOne(accessLog as DataDocument);

			return reply.status(StatusCodes.NOT_FOUND).send({
				success: false,
				errors: [{ message: phoneNumber != null ? 'User not found for this phone number' : 'User not found for this email' }],
			});
		}

		// Find valid OTP request
		const otpRequest = await findValidOtpRequest(user._id, phoneNumber, email);
		if (otpRequest == null) {
			const userAgent = req.headers['user-agent'];
			const ua = new UAParser(userAgent ?? 'API Call').getResult();
			const ip = extractIp(req);

			const accessLog: Record<string, unknown> = {
				_id: randomId(),
				_createdAt: new Date(),
				_updatedAt: new Date(),
				ip,
				login: identifier,
				browser: ua.browser.name,
				browserVersion: ua.browser.version,
				browserEngine: ua.engine.name,
				browserEngineVersion: ua.engine.version,
				os: ua.os.name,
				platform: ua.device.type,
				...(source != null && { source }),
				...(fingerprint != null && { fingerprint }),
				reason: 'OTP not found or expired',
				__from: 'verify-otp',
				_user: [
					{
						_id: user._id?.toString() || `${user._id}`,
						name: user.name,
						group: user.group,
					},
				],
			};

			// Process resolution if provided
			if (resolution != null) {
				if (typeof resolution === 'string') {
					accessLog.resolution = JSON.parse(resolution);
				} else {
					accessLog.resolution = resolution;
				}
			}

			// Process geolocation if provided
			if (geolocation != null) {
				if (typeof geolocation === 'string') {
					const { lng, lat } = JSON.parse(geolocation);
					accessLog.geolocation = [lng, lat];
				} else {
					const { longitude, latitude } = geolocation;
					accessLog.geolocation = [longitude, latitude];
				}
			}

			await MetaObject.Collections.AccessFailedLog.insertOne(accessLog as DataDocument);

			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'OTP not found or expired. Please request a new OTP.' }],
			});
		}

		// Check attempts limit
		if (hasExceededMaxAttempts(otpRequest)) {
			const userAgent = req.headers['user-agent'];
			const ua = new UAParser(userAgent ?? 'API Call').getResult();
			const ip = extractIp(req);

			const accessLog: Record<string, unknown> = {
				_id: randomId(),
				_createdAt: new Date(),
				_updatedAt: new Date(),
				ip,
				login: identifier,
				browser: ua.browser.name,
				browserVersion: ua.browser.version,
				browserEngine: ua.engine.name,
				browserEngineVersion: ua.engine.version,
				os: ua.os.name,
				platform: ua.device.type,
				...(source != null && { source }),
				...(fingerprint != null && { fingerprint }),
				reason: 'Max verification attempts exceeded',
				__from: 'verify-otp',
				_user: [
					{
						_id: user._id?.toString() || `${user._id}`,
						name: user.name,
						group: user.group,
					},
				],
			};

			// Process resolution if provided
			if (resolution != null) {
				if (typeof resolution === 'string') {
					accessLog.resolution = JSON.parse(resolution);
				} else {
					accessLog.resolution = resolution;
				}
			}

			// Process geolocation if provided
			if (geolocation != null) {
				if (typeof geolocation === 'string') {
					const { lng, lat } = JSON.parse(geolocation);
					accessLog.geolocation = [lng, lat];
				} else {
					const { longitude, latitude } = geolocation;
					accessLog.geolocation = [longitude, latitude];
				}
			}

			await MetaObject.Collections.AccessFailedLog.insertOne(accessLog as DataDocument);

			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Maximum verification attempts exceeded. Please request a new OTP.' }],
			});
		}

		// Verify OTP code
		const isValid = await verifyOTP(otpCode, otpRequest.otpHash);
		if (!isValid) {
			await incrementAttempts(otpRequest._id!);

			const userAgent = req.headers['user-agent'];
			const ua = new UAParser(userAgent ?? 'API Call').getResult();
			const ip = extractIp(req);

			const accessLog: Record<string, unknown> = {
				_id: randomId(),
				_createdAt: new Date(),
				_updatedAt: new Date(),
				ip,
				login: identifier,
				browser: ua.browser.name,
				browserVersion: ua.browser.version,
				browserEngine: ua.engine.name,
				browserEngineVersion: ua.engine.version,
				os: ua.os.name,
				platform: ua.device.type,
				...(source != null && { source }),
				...(fingerprint != null && { fingerprint }),
				reason: 'Invalid OTP code',
				__from: 'verify-otp',
				_user: [
					{
						_id: user._id?.toString() || `${user._id}`,
						name: user.name,
						group: user.group,
					},
				],
			};

			// Process resolution if provided
			if (resolution != null) {
				if (typeof resolution === 'string') {
					accessLog.resolution = JSON.parse(resolution);
				} else {
					accessLog.resolution = resolution;
				}
			}

			// Process geolocation if provided
			if (geolocation != null) {
				if (typeof geolocation === 'string') {
					const { lng, lat } = JSON.parse(geolocation);
					accessLog.geolocation = [lng, lat];
				} else {
					const { longitude, latitude } = geolocation;
					accessLog.geolocation = [longitude, latitude];
				}
			}

			await MetaObject.Collections.AccessFailedLog.insertOne(accessLog as DataDocument);

			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Invalid OTP code' }],
			});
		}

		// Remove OTP after successful verification (one-time use)
		await removeOtpRequest(otpRequest._id!);

		// Generate auth token
		const hashStampedToken = generateStampedLoginToken();

		// Update user
		await MetaObject.Collections.User.updateOne(
			{ _id: user._id },
			{
				$set: {
					lastLogin: new Date(),
				},
				$push: {
					'services.resume.loginTokens': hashStampedToken,
				},
			} as any,
		);

		// Create AccessLog with all available data (same format as traditional login)
		const userAgent = req.headers['user-agent'];
		const ua = new UAParser(userAgent ?? 'API Call').getResult();
		const ip = extractIp(req);

		const accessLog: Record<string, unknown> = {
			_id: randomId(),
			_createdAt: new Date(),
			_updatedAt: new Date(),
			ip,
			login: identifier,
			browser: ua.browser.name,
			browserVersion: ua.browser.version,
			browserEngine: ua.engine.name,
			browserEngineVersion: ua.engine.version,
			os: ua.os.name,
			platform: ua.device.type,
			...(phoneNumber != null && { phoneUsed: phoneNumber }),
			...(email != null && { emailUsed: email }),
			...(source != null && { source }),
			...(fingerprint != null && { fingerprint }),
			__from: 'verify-otp',
			_user: [
				{
					_id: user._id?.toString() || `${user._id}`,
					name: user.name,
					group: user.group,
				},
			],
		};

		// Process resolution if provided
		if (resolution != null) {
			if (typeof resolution === 'string') {
				accessLog.resolution = JSON.parse(resolution);
			} else {
				accessLog.resolution = resolution;
			}
		}

		// Process geolocation if provided
		if (geolocation != null) {
			if (typeof geolocation === 'string') {
				const { lng, lat } = JSON.parse(geolocation);
				accessLog.geolocation = [lng, lat];
			} else {
				const { longitude, latitude } = geolocation;
				accessLog.geolocation = [longitude, latitude];
			}
		} else if (MetaObject.Namespace.trackUserGeolocation === true) {
			accessLog.reason = 'Geolocation required';
			await MetaObject.Collections.AccessFailedLog.insertOne(accessLog as DataDocument);
			return reply.status(StatusCodes.BAD_REQUEST).send({
				success: false,
				errors: [{ message: 'Geolocation required' }],
			});
		}

		if (MetaObject.Collections.AccessLog != null) {
			await MetaObject.Collections.AccessLog.insertOne(accessLog as DataDocument);
		}

		// Clean up old sessions
		await cleanupSessions(user._id);

		// Return success response (same format as login)
		return reply.send({
			success: true,
			logged: true,
			authId: hashStampedToken.hashedToken,
			user: {
				_id: user._id,
				access: user.access,
				admin: user.admin,
				email: get(user, 'emails.0.address'),
				group: user.group,
				locale: user.locale,
				login: user.username,
				name: user.name,
				namespace: user.namespace,
				role: user.role,
			},
		});
	});

	done();
};

export default fp(otpApi);
