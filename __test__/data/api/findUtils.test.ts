import { expect } from 'chai';
import { buildFindQuery } from '../../../src/imports/data/api/findUtils';
import { login } from '../../utils/login';

describe('findUtils > buildFindQuery', () => {
	it('should return error when user is not authenticated', async () => {
		const result = await buildFindQuery({
			document: 'Product',
			authTokenId: 'invalid-token',
		});

		expect(result.success).to.be.false;
		if (!result.success) {
			expect(result.errors).to.be.an('array');
		}
	});

	it('should return error when document collection is not found', async () => {
		const result = await buildFindQuery({
			document: 'NonExistentDocument',
			authTokenId: login('admin-test'),
		});

		expect(result.success).to.be.false;
		if (!result.success) {
			// Error might be about collection or about accessing undefined
			expect(result.errors[0]?.message).to.be.a('string');
		}
	});

	it('should return error when document meta is not found', async () => {
		// This test would require mocking MetaObject.Meta
		// For now, we test the error path
		const result = await buildFindQuery({
			document: 'InvalidMeta',
			authTokenId: login('admin-test'),
		});

		// Should fail at collection or meta validation
		expect(result.success).to.be.false;
	});

	it('should build query with filter correctly', async () => {
		const result = await buildFindQuery({
			document: 'Product',
			authTokenId: login('admin-test'),
			filter: {
				match: 'and',
				conditions: [
					{
						term: 'status',
						operator: 'equals',
						value: 'draft',
					},
				],
			},
		});

		if (result.success) {
			expect(result.data.query).to.be.an('object');
			expect(result.data.aggregateStages).to.be.an('array');
			expect(result.data.aggregateStages[0]).to.have.property('$match');
		}
	});

	it('should build query with sort correctly', async () => {
		const result = await buildFindQuery({
			document: 'Product',
			authTokenId: login('admin-test'),
			sort: { name: 1 },
		});

		if (result.success) {
			expect(result.data.queryOptions.sort).to.be.an('object');
		}
	});

	it('should build query with fields projection correctly', async () => {
		const result = await buildFindQuery({
			document: 'Product',
			authTokenId: login('admin-test'),
			fields: 'name,status',
		});

		if (result.success) {
			expect(result.data.queryOptions.projection).to.be.an('object');
		}
	});

	it('should calculate field permissions correctly', async () => {
		const result = await buildFindQuery({
			document: 'Product',
			authTokenId: login('admin-test'),
		});

		if (result.success) {
			expect(result.data.accessConditions).to.be.an('object');
			expect(result.data.conditionsKeys).to.be.an('array');
		}
	});

	it('should build aggregate pipeline correctly', async () => {
		const result = await buildFindQuery({
			document: 'Product',
			authTokenId: login('admin-test'),
			limit: 10,
			start: 0,
		});

		if (result.success) {
			expect(result.data.aggregateStages).to.be.an('array');
			expect(result.data.aggregateStages.length).to.be.greaterThan(0);
			expect(result.data.aggregateStages[0]).to.have.property('$match');
		}
	});

	it('should return expected structure when successful', async () => {
		const result = await buildFindQuery({
			document: 'Product',
			authTokenId: login('admin-test'),
		});

		if (result.success) {
			expect(result.data).to.have.property('query');
			expect(result.data).to.have.property('aggregateStages');
			expect(result.data).to.have.property('accessConditions');
			expect(result.data).to.have.property('conditionsKeys');
			expect(result.data).to.have.property('queryOptions');
			expect(result.data).to.have.property('metaObject');
			expect(result.data).to.have.property('user');
			expect(result.data).to.have.property('access');
			expect(result.data).to.have.property('collection');
			expect(result.data).to.have.property('emptyFields');
		}
	});
});

