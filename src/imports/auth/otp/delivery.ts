import get from 'lodash/get';
import { randomId } from '@imports/utils/random';
import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { DataDocument } from '@imports/types/data';
import { logger } from '@imports/utils/logger';
import queueManager from '@imports/queue/QueueManager';
import { sendOtpViaWhatsApp, WhatsAppConfig } from './whatsapp';
import { OTP_DEFAULT_EXPIRATION_MINUTES } from '../../consts';

export interface DeliveryResult {
	success: boolean;
	method?: 'whatsapp' | 'rabbitmq' | 'email';
	error?: string;
}

/**
 * Get WhatsApp config from Namespace or environment
 */
function getWhatsAppConfig(): WhatsAppConfig | null {
	const whatsappConfig = MetaObject.Namespace.otpConfig?.whatsapp;
	if (whatsappConfig != null) {
		return whatsappConfig;
	}

	// Fallback to environment variables
	const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
	const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
	const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
	const templateId = process.env.WHATSAPP_TEMPLATE_ID;
	const hasCopyButtonEnv = process.env.HAS_COPY_BUTTON;
	const hasCopyButton = hasCopyButtonEnv != null ? hasCopyButtonEnv.toLowerCase() === 'true' : undefined;

	if (accessToken && phoneNumberId && templateId) {
		return {
			accessToken,
			phoneNumberId,
			...(businessAccountId != null && { businessAccountId }),
			templateId,
			...(hasCopyButton !== undefined && { hasCopyButton }),
		};
	}

	return null;
}

/**
 * Send OTP via WhatsApp (Priority 1)
 */
async function sendViaWhatsApp(phoneNumber: string, otpCode: string): Promise<DeliveryResult> {
	const config = getWhatsAppConfig();
	if (config == null) {
		return {
			success: false,
			error: 'WhatsApp configuration not available',
		};
	}

	const result = await sendOtpViaWhatsApp(phoneNumber, otpCode, config);
	if (result.success) {
		return { success: true, method: 'whatsapp' };
	}

	return {
		success: false,
		error: result.error,
	};
}

/**
 * Send OTP via RabbitMQ queue (Priority 2)
 */
async function sendViaRabbitMQ(phoneNumber: string, otpCode: string, userId: string, expiresAt: Date): Promise<DeliveryResult> {
	const queueName = MetaObject.Namespace.otpConfig?.rabbitmqQueue;
	if (queueName == null) {
		return {
			success: false,
			error: 'RabbitMQ queue not configured',
		};
	}

	const queueConfig = MetaObject.Namespace.QueueConfig;
	if (queueConfig == null || queueConfig.resources == null) {
		return {
			success: false,
			error: 'Queue configuration not found',
		};
	}

	const resourceNames = Object.keys(queueConfig.resources);
	if (resourceNames.length === 0) {
		return {
			success: false,
			error: 'No queue resources configured',
		};
	}

	// Fetch user to get email
	const user = (await MetaObject.Collections.User.findOne({ _id: userId }, { projection: { _id: 1, emails: 1 } })) as Pick<User, '_id' | 'emails'> | null;
	const emailAddress = user != null ? get(user, 'emails.0.address') : null;

	const resourceName = resourceNames[0];
	const message = {
		type: 'otp',
		phoneNumber,
		otpCode,
		userId,
		email: emailAddress,
		expiresAt: expiresAt.toISOString(),
	};

	try {
		const result = await queueManager.sendMessage(resourceName, queueName, message);
		if (result != null && result.success) {
			return { success: true, method: 'rabbitmq' };
		}

		return {
			success: false,
			error: typeof result?.errors?.[0] === 'string' ? result.errors[0] : (result?.errors?.[0]?.message ?? 'Failed to send message to queue'),
		};
	} catch (error) {
		logger.error(error, 'Error sending OTP via RabbitMQ');
		return {
			success: false,
			error: (error as Error).message,
		};
	}
}

/**
 * Send OTP via Email (Priority 3 - Final fallback, or direct if requested by email)
 * @param phoneNumber - Phone number (optional, for logging)
 * @param otpCode - OTP code to send
 * @param userId - User ID
 * @param expiresAt - OTP expiration date
 * @param requestEmail - Email used to request OTP (takes priority over user email)
 */
async function sendViaEmail(phoneNumber: string | undefined, otpCode: string, userId: string, expiresAt: Date, requestEmail?: string): Promise<DeliveryResult> {
	// Use request email if provided, otherwise get from user
	const getUserEmail = async (): Promise<string | null> => {
		const user = (await MetaObject.Collections.User.findOne({ _id: userId }, { projection: { emails: 1 } })) as Pick<User, 'emails'> | null;
		if (user == null) {
			return null;
		}
		return get(user, 'emails.0.address') ?? null;
	};

	const emailAddress = requestEmail ?? (await getUserEmail());

	if (emailAddress == null) {
		const user = (await MetaObject.Collections.User.findOne({ _id: userId }, { projection: { emails: 1 } })) as Pick<User, 'emails'> | null;
		if (user == null) {
			return {
				success: false,
				error: 'User not found',
			};
		}
		return {
			success: false,
			error: 'User does not have an email address',
		};
	}

	const expirationMinutes = MetaObject.Namespace.otpConfig?.expirationMinutes ?? OTP_DEFAULT_EXPIRATION_MINUTES;
	const templateId = MetaObject.Namespace.otpConfig?.emailTemplateId ?? 'email/otp.hbs';
	const emailFrom = MetaObject.Namespace.otpConfig?.emailFrom ?? 'Konecty <support@konecty.com>';

	// Fetch user name for email template
	const user = (await MetaObject.Collections.User.findOne({ _id: userId }, { projection: { name: 1 } })) as Pick<User, 'name'> | null;

	const messageData = {
		_id: randomId(),
		from: emailFrom,
		to: emailAddress,
		subject: '[Konecty] Código de Verificação OTP',
		type: 'Email',
		status: 'Send',
		template: templateId,
		discard: true,
		_createdAt: new Date(),
		_updatedAt: new Date(),
		data: {
			otpCode,
			...(phoneNumber != null && { phoneNumber }),
			...(emailAddress != null && { email: emailAddress }),
			expirationMinutes,
			expiresAt: expiresAt.toISOString(),
			name: user?.name,
		},
	};

	try {
		await MetaObject.Collections.Message.insertOne(messageData as DataDocument);
		return { success: true, method: 'email' };
	} catch (error) {
		logger.error(error, 'Error sending OTP via email');
		return {
			success: false,
			error: (error as Error).message,
		};
	}
}

/**
 * Main delivery function
 * If email is provided, sends directly via email only (no WhatsApp)
 * If phoneNumber is provided, tries: WhatsApp → RabbitMQ (no email fallback)
 */
export async function sendOtp(phoneNumber: string | undefined, email: string | undefined, otpCode: string, userId: string, expiresAt: Date): Promise<DeliveryResult> {
	if (email != null) {
		// Requested by email - send directly via email only (skip WhatsApp)
		return await sendViaEmail(phoneNumber, otpCode, userId, expiresAt, email);
	}

	if (phoneNumber != null) {
		// Requested by phone - try WhatsApp → RabbitMQ (no email fallback)
		const whatsappResult = await sendViaWhatsApp(phoneNumber, otpCode);
		if (whatsappResult.success) {
			return whatsappResult;
		}

		logger.warn(`WhatsApp delivery failed: ${whatsappResult.error}. Trying RabbitMQ...`);

		const rabbitmqResult = await sendViaRabbitMQ(phoneNumber, otpCode, userId, expiresAt);
		if (rabbitmqResult.success) {
			return rabbitmqResult;
		}

		logger.error(`All phone delivery methods failed. WhatsApp: ${whatsappResult.error}, RabbitMQ: ${rabbitmqResult.error}`);
		return {
			success: false,
			error: `Failed to send OTP via phone: WhatsApp (${whatsappResult.error}), RabbitMQ (${rabbitmqResult.error})`,
		};
	}

	return {
		success: false,
		error: 'Either phoneNumber or email must be provided',
	};
}
