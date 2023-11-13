import { expect } from 'chai';
import * as KonectyApi from '../utils/api';
import { db } from '@imports/database';
import products from '../fixtures/mongodb/permissions/data.Product.json';
const UsersAuth = {
	Default: '__user_is_default__',
	User: '__user_is_broker__',
};
const DEFAULT_UPDATED_AT = { $date: '2023-01-01T00:00:00.000+0000' };

describe('Permissions', () => {
	beforeAll(async () => {
		db.collection('data.Product').insertMany(products as any[]);
	});

	afterAll(async () => {
		await db.collection('data.Product').deleteMany({});
	});
	describe('With conditions', () => {
		const FIELD_WITH_CONDITIONS = { UPDATE: 'notes', READ: 'supplier' };

		describe('Should block', () => {
			it('to read if the user is not the owner', async () => {
				const response = await KonectyApi.get(`/data/Product/Product_from_user_Default?fields=${FIELD_WITH_CONDITIONS.READ},code`, UsersAuth.User);
				const konResponse = await response.json();

				expect(konResponse.success).to.be.true;
				const product = konResponse.data?.[0];

				expect(product).to.be.not.undefined;
				expect(product).to.have.property('code');
				expect(product).to.not.have.property(FIELD_WITH_CONDITIONS.READ);
			});
			it('to update if the user is not the owner', async () => {
				const payload = { data: { [FIELD_WITH_CONDITIONS.UPDATE]: 'UPDATE LESGAL' }, ids: [{ _id: 'Product_from_user_Default', _updatedAt: DEFAULT_UPDATED_AT }] };
				const response = await KonectyApi.put('/data/Product', payload, UsersAuth.User);

				const konResponse = await response.json();

				expect(konResponse.success).to.be.false;
				expect(konResponse.errors).to.be.not.empty;
				expect(konResponse.errors?.[0]?.message).to.includes("You don't have permission to update records Product_from_user_Default");
			});
		});

		describe('Should allow', () => {
			it('to read if the user is the owner', async () => {
				const response = await KonectyApi.get(`/data/Product/Product_from_user_User?fields=${FIELD_WITH_CONDITIONS.READ},code`, UsersAuth.User);
				const konResponse = await response.json();

				expect(konResponse.success).to.be.true;
				const product = konResponse.data?.[0];

				expect(product).to.be.not.undefined;
				expect(product).to.have.property('code');
				expect(product).to.have.property(FIELD_WITH_CONDITIONS.READ);
			});
			it('to update if the user is the owner', async () => {
				const payload = { data: { [FIELD_WITH_CONDITIONS.UPDATE]: 'UPDATE LESGAL' }, ids: [{ _id: 'Product_from_user_User', _updatedAt: DEFAULT_UPDATED_AT }] };
				const response = await KonectyApi.put('/data/Product', payload, UsersAuth.User);

				const konResponse = await response.json();

				expect(konResponse.success).to.be.true;
				expect(konResponse.errors).to.be.undefined;
				expect(konResponse.data).to.not.be.empty;
				expect(konResponse.data?.[0]?.[FIELD_WITH_CONDITIONS.UPDATE]).to.be.equal(payload.data[FIELD_WITH_CONDITIONS.UPDATE]);
			});
			it('to create with valid status', async () => {
				const payload = { name: 'Test', status: 'draft' };
				const response = await KonectyApi.post('/data/Product', payload, UsersAuth.User);

				const konResponse = await response.json();

				expect(konResponse.success).to.be.true;
				expect(konResponse.errors).to.be.undefined;
				expect(konResponse.data).to.not.be.empty;
				expect(konResponse.data?.[0]?.status).to.be.equal(payload.status);
			});
		});
	});

	describe('Flat permissions', () => {
		const FIELD_WITH_FLAT_PERM = 'highlight';
		const FIELD_WITHOUT_PERM = 'sku';

		describe('Should block', () => {
			it('to read if not allowed', async () => {
				const response = await KonectyApi.get(`/data/Product/Product_from_user_Default?fields=${FIELD_WITH_FLAT_PERM},code`, UsersAuth.User);
				const konResponse = await response.json();

				expect(konResponse.success).to.be.true;
				const product = konResponse.data?.[0];

				expect(product).to.be.not.undefined;
				expect(product).to.have.property('code');
				expect(product).to.not.have.property(FIELD_WITH_FLAT_PERM);
			});
			it('to update if not allowed', async () => {
				const payload = { data: { [FIELD_WITH_FLAT_PERM]: 'UPDATE LESGAL' }, ids: [{ _id: 'Product_from_user_Default', _updatedAt: DEFAULT_UPDATED_AT }] };
				const response = await KonectyApi.put('/data/Product', payload, UsersAuth.User);

				const konResponse = await response.json();

				expect(konResponse.success).to.be.false;
				expect(konResponse.errors).to.be.not.empty;
				expect(konResponse.errors?.[0]?.message).to.includes("You don't have permission to update records Product_from_user_Default");
			});
			it('to create if not allowed', async () => {
				const payload = { [FIELD_WITH_FLAT_PERM]: 'CREATE LESGAL', name: 'Test' };
				const response = await KonectyApi.post('/data/Product', payload, UsersAuth.User);

				const konResponse = await response.json();

				expect(konResponse.success).to.be.false;
				expect(konResponse.errors).to.be.not.empty;
				expect(konResponse.errors?.[0]?.message).to.includes(FIELD_WITH_FLAT_PERM);
			});
		});

		describe('Should allow', () => {
			it('to read when allowed', async () => {
				const response = await KonectyApi.get(`/data/Product/Product_from_user_User?fields=${FIELD_WITHOUT_PERM},code`, UsersAuth.User);
				const konResponse = await response.json();

				expect(konResponse.success).to.be.true;
				const product = konResponse.data?.[0];

				expect(product).to.be.not.undefined;
				expect(product).to.have.property('code');
				expect(product).to.have.property(FIELD_WITHOUT_PERM);
			});
			it('to update when allowed', async () => {
				const payload = { data: { [FIELD_WITHOUT_PERM]: 'UPDATE LESGAL' }, ids: [{ _id: 'Product_from_user_User', _updatedAt: DEFAULT_UPDATED_AT }] };
				const response = await KonectyApi.put('/data/Product', payload, UsersAuth.User);

				const konResponse = await response.json();

				expect(konResponse.success).to.be.true;
				expect(konResponse.errors).to.be.undefined;
				expect(konResponse.data).to.not.be.empty;
				expect(konResponse.data?.[0]?.[FIELD_WITHOUT_PERM]).to.be.equal(payload.data[FIELD_WITHOUT_PERM]);
			});
		});
	});
});
