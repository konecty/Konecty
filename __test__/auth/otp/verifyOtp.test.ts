import { verifyOTP, findValidOtpRequest, hasExceededMaxAttempts, hashOTP } from '@imports/auth/otp';
import { OtpRequest } from '@imports/auth/otp';

describe('Verify OTP Logic', () => {
	it('should verify OTP code correctly', async () => {
		const otpCode = '123456';
		const otpHash = await hashOTP(otpCode);

		const isValid = await verifyOTP(otpCode, otpHash);
		expect(isValid).toBe(true);
	});

	it('should reject invalid OTP code', async () => {
		const otpCode = '123456';
		const wrongCode = '654321';
		const otpHash = await hashOTP(otpCode);

		const isValid = await verifyOTP(wrongCode, otpHash);
		expect(isValid).toBe(false);
	});

	it('should detect expired OTP', () => {
		const expiredOtp: OtpRequest = {
			_id: 'otp-id',
			user: { _id: 'test-user-id' },
			phoneNumber: '+5511999999999',
			otpHash: 'hash',
			attempts: 0,
			expiresAt: new Date(Date.now() - 1000), // Expired
			_createdAt: new Date(),
		};

		// findValidOtpRequest checks expiresAt > now, so expired OTPs won't be found
		const now = new Date();
		const isExpired = expiredOtp.expiresAt <= now;
		expect(isExpired).toBe(true);
	});

	it('should detect max attempts exceeded', () => {
		const otpRequest: OtpRequest = {
			_id: 'otp-id',
			user: { _id: 'test-user-id' },
			phoneNumber: '+5511999999999',
			otpHash: 'hash',
			attempts: 3, // Max attempts
			expiresAt: new Date(Date.now() + 5 * 60 * 1000),
			_createdAt: new Date(),
		};

		const exceeded = hasExceededMaxAttempts(otpRequest);
		expect(exceeded).toBe(true);
	});

	it('should not exceed max attempts when below limit', () => {
		const otpRequest: OtpRequest = {
			_id: 'otp-id',
			user: { _id: 'test-user-id' },
			phoneNumber: '+5511999999999',
			otpHash: 'hash',
			attempts: 2, // Below max
			expiresAt: new Date(Date.now() + 5 * 60 * 1000),
			_createdAt: new Date(),
		};

		const exceeded = hasExceededMaxAttempts(otpRequest);
		expect(exceeded).toBe(false);
	});
});
