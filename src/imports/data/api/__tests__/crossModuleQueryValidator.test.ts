import { CrossModuleQuerySchema } from '@imports/types/crossModuleQuery';
import { validateCrossModuleQuery, resolveRelationLookup, buildRelationFilter } from '../crossModuleQueryValidator';
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
		code: { type: 'number' },
		name: { type: 'personName' },
		status: { type: 'text' },
	},
};

const OPPORTUNITY_META = {
	type: 'document',
	fields: {
		code: { type: 'number' },
		contact: { type: 'lookup', document: 'Contact' },
		campaign: { type: 'lookup', document: 'Campaign' },
		status: { type: 'text' },
	},
};

const PRODUCT_META = {
	type: 'document',
	fields: {
		code: { type: 'number' },
		type: { type: 'text' },
	},
};

const PPO_META = {
	type: 'document',
	fields: {
		product: { type: 'lookup', document: 'Product' },
		opportunity: { type: 'lookup', document: 'Opportunity' },
		status: { type: 'text' },
	},
};

function setupMetadata() {
	(MetaObject.Meta as any) = {
		Contact: CONTACT_META,
		Opportunity: OPPORTUNITY_META,
		Product: PRODUCT_META,
		ProductsPerOpportunities: PPO_META,
	};
}

describe('CrossModuleQuerySchema (Zod)', () => {
	it('should validate a minimal valid query', () => {
		const result = CrossModuleQuerySchema.safeParse({
			document: 'Contact',
			relations: [
				{
					document: 'Opportunity',
					lookup: 'contact',
					aggregators: { count: { aggregator: 'count' } },
				},
			],
		});
		expect(result.success).toBe(true);
	});

	it('should validate a full query with all fields', () => {
		const result = CrossModuleQuerySchema.safeParse({
			document: 'Contact',
			filter: { match: 'and', conditions: [{ term: 'status', operator: 'equals', value: 'active' }] },
			fields: 'code,name',
			sort: [{ property: 'name.full', direction: 'ASC' }],
			limit: 100,
			start: 0,
			includeTotal: true,
			includeMeta: true,
			relations: [
				{
					document: 'Opportunity',
					lookup: 'contact',
					filter: { match: 'and', conditions: [{ term: 'status', operator: 'in', value: ['Nova'] }] },
					fields: 'code,status',
					sort: [{ property: '_createdAt', direction: 'DESC' }],
					limit: 50,
					aggregators: {
						activeOpportunities: { aggregator: 'count' },
						opportunities: { aggregator: 'push' },
					},
				},
			],
		});
		expect(result.success).toBe(true);
	});

	it('should reject a query without document', () => {
		const result = CrossModuleQuerySchema.safeParse({
			relations: [{ document: 'Opportunity', lookup: 'contact', aggregators: { c: { aggregator: 'count' } } }],
		});
		expect(result.success).toBe(false);
	});

	it('should reject a query without relations', () => {
		const result = CrossModuleQuerySchema.safeParse({ document: 'Contact' });
		expect(result.success).toBe(false);
	});

	it('should reject empty relations array', () => {
		const result = CrossModuleQuerySchema.safeParse({ document: 'Contact', relations: [] });
		expect(result.success).toBe(false);
	});

	it('should reject a relation without aggregators', () => {
		const result = CrossModuleQuerySchema.safeParse({
			document: 'Contact',
			relations: [{ document: 'Opportunity', lookup: 'contact', aggregators: {} }],
		});
		expect(result.success).toBe(false);
	});

	it('should reject invalid aggregator name', () => {
		const result = CrossModuleQuerySchema.safeParse({
			document: 'Contact',
			relations: [
				{ document: 'Opportunity', lookup: 'contact', aggregators: { x: { aggregator: 'invalid' } } },
			],
		});
		expect(result.success).toBe(false);
	});

	it('should accept all 9 valid aggregators', () => {
		const aggregators = ['count', 'sum', 'avg', 'min', 'max', 'first', 'last', 'push', 'addToSet'] as const;
		for (const agg of aggregators) {
			const result = CrossModuleQuerySchema.safeParse({
				document: 'Contact',
				relations: [
					{
						document: 'Opportunity',
						lookup: 'contact',
						aggregators: { test: { aggregator: agg, field: agg === 'count' ? undefined : 'code' } },
					},
				],
			});
			expect(result.success).toBe(true);
		}
	});

	it('should validate recursive relations', () => {
		const result = CrossModuleQuerySchema.safeParse({
			document: 'Contact',
			relations: [
				{
					document: 'Opportunity',
					lookup: 'contact',
					aggregators: { count: { aggregator: 'count' } },
					relations: [
						{
							document: 'ProductsPerOpportunities',
							lookup: 'opportunity',
							aggregators: { productCount: { aggregator: 'count' } },
						},
					],
				},
			],
		});
		expect(result.success).toBe(true);
	});

	it('should apply default limit and start values', () => {
		const result = CrossModuleQuerySchema.safeParse({
			document: 'Contact',
			relations: [{ document: 'Opportunity', lookup: 'contact', aggregators: { c: { aggregator: 'count' } } }],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(1000);
			expect(result.data.start).toBe(0);
		}
	});
});

describe('validateCrossModuleQuery', () => {
	beforeEach(setupMetadata);

	it('should accept a valid query with existing metadata', () => {
		const result = validateCrossModuleQuery({
			document: 'Contact',
			relations: [
				{
					document: 'Opportunity',
					lookup: 'contact',
					aggregators: { count: { aggregator: 'count' } },
				},
			],
		});
		expect(result.success).toBe(true);
	});

	it('should reject a query with non-existent primary document', () => {
		const result = validateCrossModuleQuery({
			document: 'NonExistent',
			relations: [{ document: 'Opportunity', lookup: 'contact', aggregators: { c: { aggregator: 'count' } } }],
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors[0].message).toContain('NonExistent');
		}
	});

	it('should reject a query with non-existent relation document', () => {
		const result = validateCrossModuleQuery({
			document: 'Contact',
			relations: [{ document: 'FakeModule', lookup: 'contact', aggregators: { c: { aggregator: 'count' } } }],
		});
		expect(result.success).toBe(false);
	});

	it('should reject sum/avg/min/max aggregators without field', () => {
		const result = validateCrossModuleQuery({
			document: 'Contact',
			relations: [
				{
					document: 'Opportunity',
					lookup: 'contact',
					aggregators: { total: { aggregator: 'sum' } },
				},
			],
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors[0].message).toContain('field');
		}
	});

	it('should accept count/push/first/last without field', () => {
		const result = validateCrossModuleQuery({
			document: 'Contact',
			relations: [
				{
					document: 'Opportunity',
					lookup: 'contact',
					aggregators: {
						c: { aggregator: 'count' },
						p: { aggregator: 'push' },
						f: { aggregator: 'first' },
						l: { aggregator: 'last' },
					},
				},
			],
		});
		expect(result.success).toBe(true);
	});
});

describe('resolveRelationLookup', () => {
	beforeEach(setupMetadata);

	it('should resolve a valid lookup', () => {
		const relation = { document: 'Opportunity', lookup: 'contact', aggregators: { c: { aggregator: 'count' as const } } };
		const result = resolveRelationLookup('Contact', relation);
		expect(result).not.toBeNull();
		expect(result?.parentKey).toBe('_id');
		expect(result?.childKey).toBe('contact._id');
		expect(result?.parentDocument).toBe('Contact');
		expect(result?.childDocument).toBe('Opportunity');
	});

	it('should return null for non-existent lookup field', () => {
		const relation = { document: 'Opportunity', lookup: 'nonExistent', aggregators: { c: { aggregator: 'count' as const } } };
		const result = resolveRelationLookup('Contact', relation);
		expect(result).toBeNull();
	});

	it('should return null if lookup points to wrong parent', () => {
		const relation = { document: 'Opportunity', lookup: 'campaign', aggregators: { c: { aggregator: 'count' as const } } };
		const result = resolveRelationLookup('Contact', relation);
		expect(result).toBeNull();
	});

	it('should use explicit on clause when provided', () => {
		const relation = {
			document: 'Opportunity',
			lookup: 'contact',
			on: { left: 'code', right: 'contact.code' },
			aggregators: { c: { aggregator: 'count' as const } },
		};
		const result = resolveRelationLookup('Contact', relation);
		expect(result).not.toBeNull();
		expect(result?.parentKey).toBe('code');
		expect(result?.childKey).toBe('contact.code');
	});
});

describe('buildRelationFilter', () => {
	it('should build a filter with $in condition', () => {
		const resolution = {
			parentDocument: 'Contact',
			childDocument: 'Opportunity',
			lookupField: 'contact',
			parentKey: '_id',
			childKey: 'contact._id',
		};
		const result = buildRelationFilter(['id1', 'id2'], resolution);
		expect(result.match).toBe('and');
		expect(result.conditions).toEqual([
			{ term: 'contact._id', operator: 'in', value: ['id1', 'id2'] },
		]);
	});

	it('should merge with relation filter', () => {
		const resolution = {
			parentDocument: 'Contact',
			childDocument: 'Opportunity',
			lookupField: 'contact',
			parentKey: '_id',
			childKey: 'contact._id',
		};
		const relationFilter = {
			match: 'and' as const,
			conditions: [{ term: 'status', operator: 'in', value: ['Nova'] }],
		};
		const result = buildRelationFilter(['id1'], resolution, relationFilter);
		expect(result.filters).toHaveLength(1);
		expect(result.filters?.[0]).toEqual(relationFilter);
	});

	it('should merge with readFilter', () => {
		const resolution = {
			parentDocument: 'Contact',
			childDocument: 'Opportunity',
			lookupField: 'contact',
			parentKey: '_id',
			childKey: 'contact._id',
		};
		const readFilter = {
			match: 'and' as const,
			conditions: [{ term: '_user._id', operator: 'equals', value: 'user1' }],
		};
		const result = buildRelationFilter(['id1'], resolution, undefined, readFilter);
		expect(result.filters).toHaveLength(1);
		expect(result.filters?.[0]).toEqual(readFilter);
	});

	it('should merge both relation filter and readFilter', () => {
		const resolution = {
			parentDocument: 'Contact',
			childDocument: 'Opportunity',
			lookupField: 'contact',
			parentKey: '_id',
			childKey: 'contact._id',
		};
		const relationFilter = {
			match: 'and' as const,
			conditions: [{ term: 'status', operator: 'equals', value: 'Nova' }],
		};
		const readFilter = {
			match: 'and' as const,
			conditions: [{ term: '_user._id', operator: 'equals', value: 'user1' }],
		};
		const result = buildRelationFilter(['id1'], resolution, relationFilter, readFilter);
		expect(result.filters).toHaveLength(2);
	});
});
