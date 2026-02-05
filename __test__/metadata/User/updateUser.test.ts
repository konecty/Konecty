import { expect } from 'chai';
import { login } from '../../utils/login';
import { KonectyResponse } from '../../utils/types';
import { faker } from '@faker-js/faker';
async function createUserHelper(authId: string) {
	const requiredFields = {
		name: faker.internet.userName(),
		active: true,
		group: { _id: 'YM3utZ6EMmrFsbHZc', name: 'User' },
		role: { _id: 'Fr9y2Gc6xisQ3NkEu', name: 'User' },
		locale: 'pt_BR',
		username: faker.internet.userName(),
	};
	const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/User`, {
		method: 'POST',
		headers: {
			Cookie: `_authTokenId=${authId}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requiredFields),
	}).then(res => res.json())) as KonectyResponse;

	return data.data?.[0];
}

describe('Update User', () => {
	describe('Admin', () => {
		const authId = login('admin-test');

		it('Update User Password', async () => {
			// Arrange
			const user = await createUserHelper(authId);

			const newPassword = 'test';

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/auth/setpassword/${user?._id}/${newPassword}`, {
				method: 'GET',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(true);
		});
	});
});
