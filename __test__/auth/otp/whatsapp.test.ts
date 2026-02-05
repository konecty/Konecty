import { sendOtpViaWhatsApp, WhatsAppConfig } from '@imports/auth/otp/whatsapp';

// Mock fetch globally
const originalFetch = global.fetch;

describe('WhatsApp Service', () => {
	beforeEach(() => {
		global.fetch = originalFetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	describe('sendOtpViaWhatsApp', () => {
		const config: WhatsAppConfig = {
			accessToken: 'test-access-token',
			phoneNumberId: 'test-phone-number-id',
			businessAccountId: 'test-business-account-id',
			templateId: 'test-template-id',
		};

		it('should send OTP successfully', async () => {
			global.fetch = () =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ messages: [{ id: 'test-message-id' }] }),
				}) as Promise<Response>;

			const result = await sendOtpViaWhatsApp('+5511999999999', '123456', config);

			expect(result.success).toBe(true);
			expect(result.method).toBeUndefined(); // Method is set in delivery service
		});

		it('should handle API errors gracefully', async () => {
			global.fetch = () =>
				Promise.resolve({
					ok: false,
					status: 400,
					json: () => Promise.resolve({ error: { message: 'Invalid phone number' } }),
				}) as Promise<Response>;

			const result = await sendOtpViaWhatsApp('+5511999999999', '123456', config);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid phone number');
		});

		it('should handle network errors', async () => {
			global.fetch = () => Promise.reject(new Error('Network error'));

			const result = await sendOtpViaWhatsApp('+5511999999999', '123456', config);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Network error');
		});

		it('should return error when config is missing', async () => {
			const emptyConfig = {} as WhatsAppConfig;
			const result = await sendOtpViaWhatsApp('+5511999999999', '123456', emptyConfig);

			// Will fail because WhatsApp config is not in Namespace
			expect(result.success).toBe(false);
		});
	});
});

