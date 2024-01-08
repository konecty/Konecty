import { expect } from 'chai';
import { login } from '../../utils/login';
import { KonectyResponse } from '../../utils/types';

async function createUserHelper(authId: string) {
	const requiredFields = {
		name: 'Teste',
		active: true,
		group: { _id: 'YM3utZ6EMmrFsbHZc', name: 'User' },
		role: { _id: 'Fr9y2Gc6xisQ3NkEu', name: 'User' },
		locale: 'pt_BR',
		username: 'teste',
	};
	const data = (await fetch(`http://127.0.0.1:3000/rest/data/User`, {
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
			const data = (await fetch(`http://127.0.0.1:3000/rest/auth/setpassword/${user?._id}/${newPassword}`, {
				method: 'GET',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
			}).then(res => res.json())) as KonectyResponse;
			console.log(data);

			// Assert
			expect(data.success).to.be.equal(true);
		});
	});
});
