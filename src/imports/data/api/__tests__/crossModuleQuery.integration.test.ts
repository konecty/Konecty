/**
 * Integration tests for the cross-module query validator and filter builder.
 * Tests Zod schema validation, lookup resolution, and filter building
 * against mock MetaObject metadata (no MongoDB needed for these tests).
 *
 * Full end-to-end tests with findStream + Python bridge require
 * a running server and are covered by Postman/API tests.
 */

import { CrossModuleQuerySchema } from '@imports/types/crossModuleQuery';
import {
	validateCrossModuleQuery,
	resolveRelationLookup,
	buildRelationFilter,
} from '../crossModuleQueryValidator';
import { MetaObject } from '@imports/model/MetaObject';

jest.mock('@imports/model/MetaObject', () => ({
	MetaObject: {
		Meta: {} as Record<string, any>,
		Collections: {},
		Access: {},
	},
}));

jest.mock('@imports/utils/logger', () => ({
	logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const CONTACT_META = {
	type: 'document',
	fields: {
		_id: { type: 'text' },
		code: { type: 'number' },
		name: { type: 'personName' },
		status: { type: 'text' },
	},
};

const OPPORTUNITY_META = {
	type: 'document',
	fields: {
		_id: { type: 'text' },
		code: { type: 'number' },
		contact: { type: 'lookup', document: 'Contact', descriptionFields: ['code', 'name'] },
		campaign: { type: 'lookup', document: 'Campaign' },
		product: { type: 'lookup', document: 'Product' },
		status: { type: 'text' },
		value: { type: 'number' },
	},
};

const ACTIVITY_META = {
	type: 'document',
	fields: {
		_id: { type: 'text' },
		code: { type: 'number' },
		subject: { type: 'text' },
		contact: { type: 'lookup', document: 'Contact' },
		product: { type: 'lookup', document: 'Product' },
		status: { type: 'text' },
	},
};

const PRODUCT_META = {
	type: 'document',
	fields: {
		_id: { type: 'text' },
		code: { type: 'number' },
		type: { type: 'text' },
		sale: { type: 'money' },
	},
};

const PPO_META = {
	type: 'document',
	fields: {
		_id: { type: 'text' },
		product: { type: 'lookup', document: 'Product' },
		opportunity: { type: 'lookup', document: 'Opportunity' },
		contact: { type: 'lookup', document: 'Contact' },
		status: { type: 'text' },
		rating: { type: 'number' },
	},
};

function setupAllMetadata() {
	(MetaObject.Meta as any) = {
		Contact: CONTACT_META,
		Opportunity: OPPORTUNITY_META,
		Activity: ACTIVITY_META,
		Product: PRODUCT_META,
		ProductsPerOpportunities: PPO_META,
	};
}

describe('Cross-Module Query Integration', () => {
	beforeEach(setupAllMetadata);

	describe('RFC Example 1: Product + PPO (push + count)', () => {
		it('should validate the query schema', () => {
			const result = CrossModuleQuerySchema.safeParse({
				document: 'Product',
				filter: {
					match: 'and',
					conditions: [{ term: '_id', operator: 'equals', value: 'fFaJkGaWAdDhvcPH6' }],
				},
				fields: 'code,type',
				limit: 1,
				relations: [
					{
						document: 'ProductsPerOpportunities',
						lookup: 'product',
						fields: 'status,rating,contact',
						sort: [{ property: '_createdAt', direction: 'DESC' }],
						limit: 100,
						aggregators: {
							offers: { aggregator: 'push' },
							offerCount: { aggregator: 'count' },
						},
					},
				],
			});
			expect(result.success).toBe(true);
		});

		it('should resolve PPO.product lookup to Product', () => {
			const relation = {
				document: 'ProductsPerOpportunities',
				lookup: 'product',
				aggregators: { offers: { aggregator: 'push' as const } },
			};
			const resolution = resolveRelationLookup('Product', relation);
			expect(resolution).not.toBeNull();
			expect(resolution?.parentKey).toBe('_id');
			expect(resolution?.childKey).toBe('product._id');
		});
	});

	describe('RFC Example 2: Contact + Opportunity (count)', () => {
		it('should validate and resolve the query', () => {
			const result = validateCrossModuleQuery({
				document: 'Contact',
				fields: 'code,name',
				sort: [{ property: 'name.full', direction: 'ASC' }],
				limit: 1000,
				relations: [
					{
						document: 'Opportunity',
						lookup: 'contact',
						filter: {
							match: 'and',
							conditions: [{ term: 'status', operator: 'in', value: ['Nova', 'Em Visitacao'] }],
						},
						aggregators: { activeOpportunities: { aggregator: 'count' } },
					},
				],
			});
			expect(result.success).toBe(true);
		});
	});

	describe('RFC Example 3: Contact + Opportunity + PPO (recursive)', () => {
		it('should validate recursive relations', () => {
			const result = validateCrossModuleQuery({
				document: 'Contact',
				filter: {
					match: 'and',
					conditions: [{ term: 'status', operator: 'equals', value: 'active' }],
				},
				fields: 'code,name',
				limit: 100,
				relations: [
					{
						document: 'Opportunity',
						lookup: 'contact',
						fields: 'code,status',
						limit: 20,
						aggregators: {
							opportunities: { aggregator: 'push' },
							opportunityCount: { aggregator: 'count' },
						},
						relations: [
							{
								document: 'ProductsPerOpportunities',
								lookup: 'opportunity',
								fields: 'status,rating,product',
								limit: 50,
								aggregators: {
									products: { aggregator: 'push' },
									productCount: { aggregator: 'count' },
								},
							},
						],
					},
				],
			});
			expect(result.success).toBe(true);
		});

		it('should resolve both levels of lookups', () => {
			const oppRelation = {
				document: 'Opportunity',
				lookup: 'contact',
				aggregators: { c: { aggregator: 'count' as const } },
			};
			const ppoRelation = {
				document: 'ProductsPerOpportunities',
				lookup: 'opportunity',
				aggregators: { c: { aggregator: 'count' as const } },
			};

			expect(resolveRelationLookup('Contact', oppRelation)).not.toBeNull();
			expect(resolveRelationLookup('Opportunity', ppoRelation)).not.toBeNull();
		});
	});

	describe('RFC Example 4: Activity + Product (first aggregator)', () => {
		it('should validate first aggregator with field', () => {
			const result = validateCrossModuleQuery({
				document: 'Activity',
				filter: {
					match: 'and',
					conditions: [{ term: 'status', operator: 'in', value: ['new', 'in-progress'] }],
				},
				fields: 'code,subject,status',
				limit: 200,
				relations: [
					{
						document: 'Product',
						lookup: 'product',
						fields: 'code,sale',
						limit: 1,
						aggregators: {
							productCode: { aggregator: 'first', field: 'code' },
							productSale: { aggregator: 'first', field: 'sale' },
						},
					},
				],
			});
			expect(result.success).toBe(true);
		});

		it('should resolve Activity.product -> Product', () => {
			const relation = {
				document: 'Product',
				lookup: 'product',
				aggregators: { c: { aggregator: 'first' as const, field: 'code' } },
			};
			const resolution = resolveRelationLookup('Activity', relation);
			expect(resolution).not.toBeNull();
			expect(resolution?.childKey).toBe('product._id');
		});
	});

	describe('Security: graceful degradation', () => {
		it('should still validate query even if user will lack access at runtime', () => {
			const result = validateCrossModuleQuery({
				document: 'Opportunity',
				fields: 'code,status',
				limit: 100,
				relations: [
					{
						document: 'Product',
						lookup: 'product',
						aggregators: {
							productCode: { aggregator: 'first', field: 'code' },
						},
					},
				],
			});
			expect(result.success).toBe(true);
		});
	});

	describe('Filter building', () => {
		it('should build correct $in filter for batch lookups', () => {
			const resolution = {
				parentDocument: 'Contact',
				childDocument: 'Opportunity',
				lookupField: 'contact',
				parentKey: '_id',
				childKey: 'contact._id',
			};

			const parentIds = ['c1', 'c2', 'c3'];
			const relationFilter = {
				match: 'and' as const,
				conditions: [{ term: 'status', operator: 'in', value: ['Nova', 'Em Visitacao'] }],
			};
			const readFilter = {
				match: 'and' as const,
				conditions: [{ term: '_user._id', operator: 'equals', value: '$user' }],
			};

			const filter = buildRelationFilter(parentIds, resolution, relationFilter, readFilter);

			expect(filter.match).toBe('and');
			expect(filter.conditions).toEqual([
				{ term: 'contact._id', operator: 'in', value: ['c1', 'c2', 'c3'] },
			]);
			expect(filter.filters).toHaveLength(2);
			expect(filter.filters?.[0]).toEqual(relationFilter);
			expect(filter.filters?.[1]).toEqual(readFilter);
		});
	});

	describe('Edge cases', () => {
		it('should reject query with lookup pointing to wrong parent', () => {
			const result = validateCrossModuleQuery({
				document: 'Contact',
				relations: [
					{
						document: 'Opportunity',
						lookup: 'campaign',
						aggregators: { c: { aggregator: 'count' } },
					},
				],
			});
			expect(result.success).toBe(false);
		});

		it('should reject non-existent lookup field', () => {
			const result = validateCrossModuleQuery({
				document: 'Contact',
				relations: [
					{
						document: 'Opportunity',
						lookup: 'nonExistentField',
						aggregators: { c: { aggregator: 'count' } },
					},
				],
			});
			expect(result.success).toBe(false);
		});

		it('should allow explicit on clause overriding lookup validation', () => {
			const result = validateCrossModuleQuery({
				document: 'Contact',
				relations: [
					{
						document: 'Opportunity',
						lookup: 'campaign',
						on: { left: '_id', right: 'contact._id' },
						aggregators: { c: { aggregator: 'count' } },
					},
				],
			});
			expect(result.success).toBe(true);
		});
	});
});
