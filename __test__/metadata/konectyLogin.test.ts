import { expect } from 'chai';
import { createHash } from 'crypto';

describe('Outros', () => {
	describe('Autenticação', () => {
		it('Login com usuario admin permitido', async () => {
			// Arrange
			const user = 'admin-test';
			const plainPassword = 'test';
			const password = createHash('md5').update(plainPassword).digest('hex');
			const password_SHA256 = createHash('sha256').update(plainPassword).digest('hex');

			// Act
			const response = await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/auth/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					user,
					password,
					password_SHA256,
					ns: 'foxter',
					resolution: { height: 1050, width: 1680 },
				}),
			});

			const data = (await response.json()) as { success: boolean };

			// Assert
			expect(data.success).to.be.equal(true);
		}, 10000);
	});
});
