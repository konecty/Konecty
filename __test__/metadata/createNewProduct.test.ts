import { expect } from 'chai';
import { login } from '../utils/login';
import { KonectyResponse } from '../utils/types';
import { db } from '@imports/database';

describe('Product', () => {
	describe('Admin', () => {
		beforeEach(async () => {
			await db.collection('data.Product').deleteMany({});
		});

		it('Product must have at least one field', async () => {
			// Arrange
			const authId = login('admin-test');
			const requiredFields = {};
			// Act

			const data = (await fetch(`http://127.0.0.1:3000/rest/data/Product`, {
				method: 'POST',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requiredFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(false);
			expect(data.errors?.[0].message).to.be.equal('[Product] Data must have at least one field');
		});

		it('Create Product', async () => {
			// Arrange
			const authId = login('admin-test');
			const requiredFields = {
				name: 'Teste',
			};

			// Act
			const data = (await fetch(`http://127.0.0.1:3000/rest/data/Product`, {
				method: 'POST',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requiredFields),
			}).then(res => res.json())) as KonectyResponse;

			console.log(data);

			// Assert
			expect(data.success).to.be.equal(true);
			expect(data.data?.[0].name).to.be.equal('Teste');
			expect(data.data?.[0].code).to.be.equal(1);
		});
	});
});
