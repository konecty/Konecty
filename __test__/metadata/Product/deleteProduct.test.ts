import { expect } from 'chai';
import { login } from '../../utils/login';
import { KonectyResponse } from '../../utils/types';
import { db } from '@imports/database';

async function createProductHelper(authId: string) {
	const requiredFields = {
		name: 'Teste',
	};
	const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
		method: 'POST',
		headers: {
			Cookie: `_authTokenId=${authId}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requiredFields),
	}).then(res => res.json())) as KonectyResponse;

	return data.data?.[0];
}

describe('Delete Product', () => {
	describe('Admin', () => {
		afterEach(async () => {
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
						_id: product?._id,
						_updatedAt: {
							$date: product?._updatedAt,
						},
					},
				],
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
				method: 'DELETE',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(true);
		});
	});

	describe('User', () => {
		afterEach(async () => {
			await db.collection('data.Product').deleteMany({});
		});

		it('Should not delete Product', async () => {
			// Arrange
			const authId = login('user-test');

			const product = await createProductHelper(authId);

			await new Promise(resolve => setTimeout(resolve, 1000));

			const requestFields = {
				ids: [
					{
						_id: product?._id,
						_updatedAt: {
							$date: product?._updatedAt,
						},
					},
				],
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
				method: 'DELETE',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(false);
			expect(data.errors?.[0].message).to.be.equal("[Product] You don't have permission to delete records");
		});
	});
});
