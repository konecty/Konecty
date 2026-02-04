import { expect } from 'chai';
import { login } from '../../utils/login';
import { KonectyResponse } from '../../utils/types';
import { db } from '@imports/database';

describe('Create Product', () => {
	describe('Admin', () => {
		const authId = login('admin-test');
		beforeEach(async () => {
			await db.collection('data.Product').deleteMany({});
		});

		it('Product must have at least one field', async () => {
			// Arrange
			const requiredFields = {};
			// Act

			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
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
			const requiredFields = {
				name: 'Teste',
			};

			const productUser = [
				{
					_id: '4ffcf81084aecfbaff50fd05',
					group: { _id: 'PvG8jXQw2J7LqwdHJ', name: 'ADMIN' },
					name: 'Admin-test',
					active: true,
				},
			];

			const createAndUpdateUser = {
				_id: '4ffcf81084aecfbaff50fd05',
				name: 'Admin-test',
				group: { _id: 'PvG8jXQw2J7LqwdHJ', name: 'ADMIN' },
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
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
		});

		it('Create Product should respect normalization field', async () => {
			// Arrange
			const requiredFields = {
				name: 'teste normalization',
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
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

	describe('User', () => {
		const authId = login('user-test');
		beforeEach(async () => {
			await db.collection('data.Product').deleteMany({});
		});

		it('Product must have at least one field', async () => {
			// Arrange
			const requiredFields = {};
			// Act

			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
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
			const requiredFields = {
				name: 'Teste',
			};

			const productUser = [
				{
					_id: 'User_access_User',
					group: { _id: 'YM3utZ6EMmrFsbHZc', name: 'User' },
					name: 'User_access_User',
					active: true,
				},
			];

			const createAndUpdateUser = {
				_id: 'User_access_User',
				name: 'User_access_User',
				group: { _id: 'YM3utZ6EMmrFsbHZc', name: 'User' },
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
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
		});

		it('Create Product should respect normalization field', async () => {
			// Arrange
			const requiredFields = {
				name: 'teste normalization',
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
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

		it('Should not create Product with active status', async () => {
			// Arrange
			const requiredFields = {
				status: 'active',
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Product`, {
				method: 'POST',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requiredFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(false);
			expect(data.errors?.[0].message).to.be.equal("[Product] You don't have permission to create field status");
		});
	});
});
