// @ts-expect-error bun:test é reconhecido apenas pelo runner do Bun
import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { MetaObject } from '@imports/model/MetaObject';
import queueManager from '@imports/queue/QueueManager';

// Mock WhatsApp module BEFORE importing delivery
const mockSendOtpViaWhatsApp = vi.fn();
vi.mock('@imports/auth/otp/whatsapp', () => ({
	sendOtpViaWhatsApp: mockSendOtpViaWhatsApp,
}));

// Now import after mock
import { sendOtp, DeliveryResult } from '@imports/auth/otp/delivery';

describe('OTP Delivery Service', () => {
	const mockUser = {
		_id: 'test-user-id',
		name: 'Test User',
		emails: [{ address: 'test@example.com' }],
	};

	const mockOtpRequest = {
		_id: 'test-otp-id',
		expiresAt: new Date(Date.now() + 5 * 60 * 1000),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock MetaObject.Collections
		if (MetaObject.Collections == null) {
			(MetaObject as any).Collections = {};
		}
		(MetaObject.Collections.User as any) = {
			findOne: vi.fn().mockResolvedValue(mockUser),
		};
		(MetaObject.Collections.Message as any) = {
			insertOne: vi.fn().mockResolvedValue({}),
		};

		// Mock Namespace with WhatsApp config
		(MetaObject.Namespace as any) = {
			otpConfig: {
				expirationMinutes: 5,
				emailTemplateId: 'email/otp.html',
				emailFrom: 'test@example.com',
				whatsapp: {
					accessToken: 'test-token',
					phoneNumberId: 'test-phone-id',
					templateId: 'test-template-id',
				},
			},
		};
	});

	describe('sendOtp - Fallback chain', () => {
		it('should try WhatsApp first, then RabbitMQ, then Email', async () => {
			// WhatsApp fails
			mockSendOtpViaWhatsApp.mockResolvedValue({ success: false, error: 'WhatsApp API error' });

			// RabbitMQ fails - configure QueueConfig
			const mockSendMessage = vi.fn().mockResolvedValue({ success: false });
			(queueManager.sendMessage as any) = mockSendMessage;

			(MetaObject.Namespace as any).otpConfig = {
				...MetaObject.Namespace.otpConfig,
				rabbitmqQueue: 'otp-queue',
			};
			(MetaObject.Namespace as any).QueueConfig = {
				resources: {
					rabbitmq: {
						type: 'rabbitmq',
						url: 'amqp://localhost',
						queues: [{ name: 'otp-queue' }],
					},
				},
			};

			const result = await sendOtp('+5511999999999', undefined, '123456', 'test-user-id', mockOtpRequest.expiresAt);

			expect(mockSendOtpViaWhatsApp).toHaveBeenCalled();
			expect(mockSendMessage).toHaveBeenCalled();
			expect(MetaObject.Collections.Message.insertOne).toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.method).toBe('email');
		});

		it('should succeed on WhatsApp if available', async () => {
			mockSendOtpViaWhatsApp.mockResolvedValue({ success: true });

			const result = await sendOtp('+5511999999999', undefined, '123456', 'test-user-id', mockOtpRequest.expiresAt);

			expect(mockSendOtpViaWhatsApp).toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.method).toBe('whatsapp');
		});

		it('should fallback to RabbitMQ if WhatsApp fails', async () => {
			mockSendOtpViaWhatsApp.mockResolvedValue({ success: false, error: 'WhatsApp unavailable' });
			const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
			(queueManager.sendMessage as any) = mockSendMessage;

			(MetaObject.Namespace as any).otpConfig = {
				expirationMinutes: 5,
				emailTemplateId: 'email/otp.html',
				emailFrom: 'test@example.com',
				whatsapp: {
					accessToken: 'test-token',
					phoneNumberId: 'test-phone-id',
					templateId: 'test-template-id',
				},
				rabbitmqQueue: 'otp-queue',
			};
			(MetaObject.Namespace as any).QueueConfig = {
				resources: {
					rabbitmq: {
						type: 'rabbitmq',
						url: 'amqp://localhost',
						queues: [{ name: 'otp-queue' }],
					},
				},
			};

			const result = await sendOtp('+5511999999999', undefined, '123456', 'test-user-id', mockOtpRequest.expiresAt);

			expect(mockSendOtpViaWhatsApp).toHaveBeenCalled();
			expect(mockSendMessage).toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.method).toBe('rabbitmq');
		});

		it('should return error if all delivery methods fail', async () => {
			mockSendOtpViaWhatsApp.mockResolvedValue({ success: false, error: 'WhatsApp error' });
			(queueManager.sendMessage as any) = vi.fn().mockResolvedValue({ success: false });
			(MetaObject.Collections.Message.insertOne as any) = vi.fn().mockRejectedValue(new Error('Email error'));

			const result = await sendOtp('+5511999999999', undefined, '123456', 'test-user-id', mockOtpRequest.expiresAt);

			expect(result.success).toBe(false);
			expect(result.error).toContain('All delivery methods failed');
		});

		it('should handle user without email gracefully', async () => {
			mockSendOtpViaWhatsApp.mockResolvedValue({ success: false, error: 'WhatsApp error' });
			(queueManager.sendMessage as any) = vi.fn().mockResolvedValue({ success: false });

			(MetaObject.Collections.User.findOne as any) = vi.fn().mockResolvedValue({
				...mockUser,
				emails: [],
			});

			const result = await sendOtp('+5511999999999', undefined, '123456', 'test-user-id', mockOtpRequest.expiresAt);

			expect(result.success).toBe(false);
			expect(result.error).toContain('User does not have an email address');
		});

		it('should send directly via email when requested by email', async () => {
			(MetaObject.Collections.Message.insertOne as any) = vi.fn().mockResolvedValue({});

			const result = await sendOtp(undefined, 'user@example.com', '123456', 'test-user-id', mockOtpRequest.expiresAt);

			expect(mockSendOtpViaWhatsApp).not.toHaveBeenCalled();
			expect(MetaObject.Collections.Message.insertOne).toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.method).toBe('email');
		});
	});
});
