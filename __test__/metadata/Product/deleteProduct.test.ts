import { expect } from 'chai';
import { login } from '../../utils/login';
import { KonectyResponse } from '../../utils/types';
import { db } from '@imports/database';

async function createProductHelper(authId: string) {
	const requiredFields = {
		name: 'Teste',
		status: 'draft',
	};
	const data = (await fetch(`http://127.0.0.1:3000/rest/data/Product`, {
		method: 'POST',
		headers: {
			Cookie: `_authTokenId=${authId}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requiredFields),
	}).then(res => res.json())) as KonectyResponse;

	return data.data?.[0];
}

describe.skip('Delete Product', () => {
	describe('Admin', () => {
		beforeEach(async () => {
			await db.collection('data.Product').deleteMany({});
		});

		it('Delete Product', async () => {
			// Arrange
			const authId = login('admin-test');

			const product = await createProductHelper(authId);

			await new Promise(resolve => setTimeout(resolve, 1000));

			const requestFields = {
				ids: [
					{
						_id: product._id,
						_updatedAt: {
							$date: product._updatedAt,
						},
					},
				],
			};
			console.log(requestFields.ids);

			// Act
			const data = (await fetch(`http://127.0.0.1:3000/rest/data/Product`, {
				method: 'DELETE',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestFields),
			}).then(res => res.json())) as KonectyResponse;
			console.log(data);

			// Assert
			expect(data.success).to.be.equal(true);
		});
	});
});
