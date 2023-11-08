import { expect } from 'chai';
import { login } from '../../utils/login';
import { KonectyResponse } from '../../utils/types';
import { db } from '@imports/database';

describe('Create Product', () => {
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

		it('Product must have status field', async () => {
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

			// Assert
			expect(data.success).to.be.equal(false);
			expect(data.errors?.[0].message).to.be.equal('Value for field status must be an array with at least 1 item');
		});

		it('Create Product', async () => {
			// Arrange
			const authId = login('admin-test');
			const requiredFields = {
				name: 'Teste',
				status: 'draft',
			};

			const productUser = [
				{
					_id: '4ffcf81084aecfbaff50fd05',
					group: { _id: '521c2fe4e4b057cdcba8e454', name: 'ADMIN' },
					name: 'Administrador',
					active: true,
				},
			];

			const createAndUpdateUser = {
				_id: '4ffcf81084aecfbaff50fd05',
				name: 'Administrador',
				group: { _id: '521c2fe4e4b057cdcba8e454', name: 'ADMIN' },
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

			// Assert
			expect(data.success).to.be.equal(true);
			expect(data.data?.[0].name).to.be.equal('Teste');
			expect(data.data?.[0]._user).to.be.deep.equal(productUser);
			expect(data.data?.[0]._updatedBy).to.be.deep.equal(createAndUpdateUser);
			expect(data.data?.[0]._createdBy).to.be.deep.equal(createAndUpdateUser);
			expect(data.data?.[0].code).to.be.equal(1);
		});

		it('Create Product should respect normalization field', async () => {
			// Arrange
			const authId = login('admin-test');
			const requiredFields = {
				name: 'teste normalization',
				status: 'draft',
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

			// Assert
			expect(data.success).to.be.equal(true);
			expect(data.data?.[0].name).to.be.equal('Teste Normalization');
		});
	});
});
