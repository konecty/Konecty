import { generateOTP, hashOTP, verifyOTP } from '@imports/auth/otp';
import { OTP_CODE_LENGTH } from '@imports/consts';

describe('OTP Service', () => {
	describe('generateOTP', () => {
		it('should generate a 6-digit OTP code', () => {
			const otp = generateOTP();
			expect(typeof otp).toBe('string');
			expect(otp.length).toBe(OTP_CODE_LENGTH);
			expect(/^\d{6}$/.test(otp)).toBe(true);
		});

		it('should generate different OTP codes on each call', () => {
			const otp1 = generateOTP();
			const otp2 = generateOTP();
			const otp3 = generateOTP();

			// Very unlikely to be the same
			const allSame = otp1 === otp2 && otp2 === otp3;
			expect(allSame).toBe(false);
		});

		it('should generate OTP codes within valid range (100000-999999)', () => {
			for (let i = 0; i < 10; i++) {
				const otp = generateOTP();
				const num = parseInt(otp, 10);
				expect(num).toBeGreaterThanOrEqual(100000);
				expect(num).toBeLessThanOrEqual(999999);
			}
		});
	});

	describe('hashOTP', () => {
		it('should hash OTP code', async () => {
			const otp = '123456';
			const hash = await hashOTP(otp);

			expect(typeof hash).toBe('string');
			expect(hash).not.toBe(otp);
			expect(hash.length).toBeGreaterThan(20); // bcrypt hashes are long
		});

		it('should generate different hashes for same OTP (due to salt)', async () => {
			const otp = '123456';
			const hash1 = await hashOTP(otp);
			const hash2 = await hashOTP(otp);

			// Different salts should produce different hashes
			expect(hash1).not.toBe(hash2);
		});
	});

	describe('verifyOTP', () => {
		it('should verify correct OTP against hash', async () => {
			const otp = '123456';
			const hash = await hashOTP(otp);

			const isValid = await verifyOTP(otp, hash);
			expect(isValid).toBe(true);
		});

		it('should reject incorrect OTP', async () => {
			const otp = '123456';
			const wrongOtp = '654321';
			const hash = await hashOTP(otp);

			const isValid = await verifyOTP(wrongOtp, hash);
			expect(isValid).toBe(false);
		});

		it('should verify OTP with different hash from same code', async () => {
			const otp = '123456';
			const hash1 = await hashOTP(otp);
			const hash2 = await hashOTP(otp);

			// Both hashes should verify the same OTP
			const isValid1 = await verifyOTP(otp, hash1);
			const isValid2 = await verifyOTP(otp, hash2);

			expect(isValid1).toBe(true);
			expect(isValid2).toBe(true);
		});
	});
});

