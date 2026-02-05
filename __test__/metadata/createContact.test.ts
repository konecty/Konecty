import { expect } from 'chai';
import { login } from '../utils/login';
import { KonectyResponse } from '../utils/types';
import { db } from '@imports/database';

describe('Contact', () => {
	describe('Admin', () => {
		beforeEach(async () => {
			await db.collection('data.Contact').deleteMany({});
		});

		it('Contact must have at least one field', async () => {
			// Arrange
			const authId = login('admin-test');
			const requiredFields = {};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Contact`, {
				method: 'POST',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requiredFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(false);
			expect(data.errors?.[0].message).to.be.equal('[Contact] Data must have at least one field');
		});

		it('Contact name is required', async () => {
			// Arrange
			const authId = login('admin-test');
			const requiredFields = {
				type: ['client'],
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Contact`, {
				method: 'POST',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requiredFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(false);
			expect(data.errors?.[0].message).to.be.equal('Field name is required');
		});

		it('Create Contact', async () => {
			// Arrange
			const authId = login('admin-test');
			const requiredFields = {
				name: {
					first: 'teste',
					last: 'teste',
				},
				type: ['client'],
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Contact`, {
				method: 'POST',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requiredFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(true);
			expect(data.data?.[0].name).to.be.deep.equal({ first: 'Teste', full: 'Teste Teste', last: 'Teste' });
			expect(data.data?.[0].type).to.be.deep.equal(['client']);
			expect(data.data?.[0].status).to.be.equal('lead'); // default value
		});

		it('Create Contact with address', async () => {
			// Arrange
			const authId = login('admin-test');
			const requiredFields = {
				name: {
					first: 'Teste',
					last: 'Teste',
				},
				type: ['client'],
				address: {
					country: 'BRA',

					geolocation: [-51.22769109999999, -30.0418722],
					state: 'RS',
					city: 'Porto Alegre',
					district: 'Praia de Belas',
					placeType: 'Avenida',
					place: 'Praia de Belas',
					number: '232',
					complement: 'teste',
				},
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/Contact`, {
				method: 'POST',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requiredFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(true);
			expect(data.data?.[0].name).to.be.deep.equal({ first: 'Teste', full: 'Teste Teste', last: 'Teste' });
			expect(data.data?.[0].address).to.be.deep.equal([requiredFields.address]);
		});
	});
});
