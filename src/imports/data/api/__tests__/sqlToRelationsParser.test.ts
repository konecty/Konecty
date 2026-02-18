import { sqlToIQR, SqlParseError, inferLookupFromJoin } from '../sqlToRelationsParser';
import { MetaObject } from '@imports/model/MetaObject';
import { validateCrossModuleQuery } from '../crossModuleQueryValidator';

jest.mock('@imports/model/MetaObject', () => ({
	MetaObject: {
		Meta: {} as Record<string, any>,
		Collections: {},
		Access: {},
	},
}));

jest.mock('@imports/utils/logger', () => ({
	logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
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
		label: { type: 'text' },
		value: { type: 'number' },
		_createdAt: { type: 'dateTime' },
	},
};

const PRODUCT_META = {
	type: 'document',
	fields: {
		code: { type: 'number' },
		type: { type: 'text' },
		sale: { type: 'money' },
	},
};

const PPO_META = {
	type: 'document',
	fields: {
		product: { type: 'lookup', document: 'Product' },
		opportunity: { type: 'lookup', document: 'Opportunity' },
		status: { type: 'text' },
		situation: { type: 'text' },
		rating: { type: 'number' },
		contact: { type: 'lookup', document: 'Contact' },
		_createdAt: { type: 'dateTime' },
	},
};

const CAMPAIGN_META = {
	type: 'document',
	fields: {
		code: { type: 'number' },
		name: { type: 'text' },
		type: { type: 'text' },
		status: { type: 'text' },
	},
};

const ACTIVITY_META = {
	type: 'document',
	fields: {
		code: { type: 'number' },
		subject: { type: 'text' },
		status: { type: 'text' },
		product: { type: 'lookup', document: 'Product' },
		_createdAt: { type: 'dateTime' },
	},
};

const MESSAGE_META = {
	type: 'document',
	fields: {
		contact: { type: 'lookup', document: 'Contact' },
		type: { type: 'text' },
		status: { type: 'text' },
		_createdAt: { type: 'dateTime' },
	},
};

function setupMetadata() {
	(MetaObject.Meta as any) = {
		Contact: CONTACT_META,
		Opportunity: OPPORTUNITY_META,
		Product: PRODUCT_META,
		ProductsPerOpportunities: PPO_META,
		Campaign: CAMPAIGN_META,
		Activity: ACTIVITY_META,
		Message: MESSAGE_META,
	};
}

describe('sqlToIQR', () => {
	beforeEach(setupMetadata);

	describe('RFC Example 1: Product + PPO with PUSH + COUNT', () => {
		const sql = `
			SELECT p.code, p.type,
				PUSH(ppo._id) AS offers,
				COUNT(ppo._id) AS offerCount
			FROM Product p
			INNER JOIN ProductsPerOpportunities ppo ON p._id = ppo.product._id
			WHERE p._id = 'fFaJkGaWAdDhvcPH6'
			GROUP BY p.code, p.type
			LIMIT 1
		`;

		it('should produce a valid IQR', () => {
			const iqr = sqlToIQR(sql);

			expect(iqr.document).toBe('Product');
			expect(iqr.limit).toBe(1);
			expect(iqr.fields).toBe('code,type');
			expect(iqr.filter).toEqual({
				match: 'and',
				conditions: [{ term: '_id', operator: 'equals', value: 'fFaJkGaWAdDhvcPH6' }],
			});

			expect(iqr.relations).toHaveLength(1);
			const rel = iqr.relations[0];
			expect(rel.document).toBe('ProductsPerOpportunities');
			expect(rel.lookup).toBe('product');
			expect(rel.aggregators.offers).toEqual({ aggregator: 'push' });
			expect(rel.aggregators.offerCount).toEqual({ aggregator: 'count' });
		});

		it('should pass round-trip validation', () => {
			const iqr = sqlToIQR(sql);
			const result = validateCrossModuleQuery(iqr);
			expect(result.success).toBe(true);
		});
	});

	describe('RFC Example 2: Contact + Opportunity with COUNT, WHERE on relation', () => {
		const sql = `
			SELECT ct.code, ct.name,
				COUNT(o._id) AS activeOpportunities
			FROM Contact ct
			INNER JOIN Opportunity o ON ct._id = o.contact._id
			WHERE o.status IN ('Nova', 'Ofertando Imveis', 'Em Visitacao')
			GROUP BY ct.code, ct.name
			ORDER BY ct.name ASC
			LIMIT 1000
		`;

		it('should produce a valid IQR', () => {
			const iqr = sqlToIQR(sql);

			expect(iqr.document).toBe('Contact');
			expect(iqr.fields).toBe('code,name');
			expect(iqr.limit).toBe(1000);
			expect(iqr.sort).toEqual([{ property: 'name', direction: 'ASC' }]);

			expect(iqr.relations).toHaveLength(1);
			const rel = iqr.relations[0];
			expect(rel.document).toBe('Opportunity');
			expect(rel.lookup).toBe('contact');
			expect(rel.aggregators.activeOpportunities).toEqual({ aggregator: 'count' });
			expect(rel.filter).toBeDefined();
			expect(rel.filter?.conditions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ term: 'status', operator: 'in' }),
				]),
			);

			expect(iqr.filter).toBeUndefined();
		});

		it('should pass round-trip validation', () => {
			const iqr = sqlToIQR(sql);
			const result = validateCrossModuleQuery(iqr);
			expect(result.success).toBe(true);
		});
	});

	describe('RFC Example 3: 3-level chain (Contact + Opportunity + PPO)', () => {
		const sql = `
			SELECT ct.code, ct.name,
				o.code AS opp_code, o.status AS opp_status, o.label,
				ppo.status AS ppo_status, ppo.rating, ppo.product
			FROM Contact ct
			INNER JOIN Opportunity o ON ct._id = o.contact._id
			INNER JOIN ProductsPerOpportunities ppo ON o._id = ppo.opportunity._id
			WHERE ct.status = 'active'
				AND o.status IN ('Nova', 'Em Visitacao')
			ORDER BY o._createdAt DESC
			LIMIT 100
		`;

		it('should produce nested relations IQR', () => {
			const iqr = sqlToIQR(sql);

			expect(iqr.document).toBe('Contact');
			expect(iqr.fields).toBe('code,name');
			expect(iqr.limit).toBe(100);
			expect(iqr.filter).toEqual({
				match: 'and',
				conditions: [{ term: 'status', operator: 'equals', value: 'active' }],
			});

			expect(iqr.relations).toHaveLength(1);
			const oppRelation = iqr.relations[0];
			expect(oppRelation.document).toBe('Opportunity');
			expect(oppRelation.lookup).toBe('contact');

			expect(oppRelation.relations).toBeDefined();
			expect(oppRelation.relations).toHaveLength(1);

			const ppoRelation = oppRelation.relations![0];
			expect(ppoRelation.document).toBe('ProductsPerOpportunities');
			expect(ppoRelation.lookup).toBe('opportunity');
		});
	});

	describe('RFC Example 4: LEFT JOIN (Activity + Product)', () => {
		const sql = `
			SELECT a.code, a.subject, a.status,
				FIRST(p.code) AS productCode,
				FIRST(p.sale) AS productSale
			FROM Activity a
			LEFT JOIN Product p ON a.product._id = p._id
			WHERE a.status IN ('new', 'in-progress')
			ORDER BY a._createdAt DESC
			LIMIT 200
		`;

		it('should produce IQR (LEFT JOIN same as INNER JOIN in IQR)', () => {
			const iqr = sqlToIQR(sql);

			expect(iqr.document).toBe('Activity');
			expect(iqr.fields).toBe('code,subject,status');
			expect(iqr.limit).toBe(200);

			expect(iqr.filter?.conditions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ term: 'status', operator: 'in', value: ['new', 'in-progress'] }),
				]),
			);

			expect(iqr.relations).toHaveLength(1);
			const rel = iqr.relations[0];
			expect(rel.document).toBe('Product');
			expect(rel.lookup).toBe('product');
			expect(rel.on).toEqual({ left: 'product._id', right: '_id' });
			expect(rel.aggregators.productCode).toEqual({ aggregator: 'first', field: 'code' });
			expect(rel.aggregators.productSale).toEqual({ aggregator: 'first', field: 'sale' });
		});

		it('should pass round-trip validation', () => {
			const iqr = sqlToIQR(sql);
			const result = validateCrossModuleQuery(iqr);
			expect(result.success).toBe(true);
		});
	});

	describe('RFC Example 5: Campaign + Opportunity with COUNT + FIRST + AVG', () => {
		const sql = `
			SELECT c.code, c.name, c.type,
				COUNT(o._id) AS totalOpportunities,
				FIRST(o._id) AS newestOpportunity,
				AVG(o.value) AS avgValue
			FROM Campaign c
			INNER JOIN Opportunity o ON c._id = o.campaign._id
			WHERE c.status = 'Ativo'
			GROUP BY c.code, c.name, c.type
			ORDER BY o._createdAt DESC
			LIMIT 50
		`;

		it('should produce a valid IQR', () => {
			const iqr = sqlToIQR(sql);

			expect(iqr.document).toBe('Campaign');
			expect(iqr.fields).toBe('code,name,type');
			expect(iqr.limit).toBe(50);

			expect(iqr.filter?.conditions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ term: 'status', operator: 'equals', value: 'Ativo' }),
				]),
			);

			expect(iqr.relations).toHaveLength(1);
			const rel = iqr.relations[0];
			expect(rel.document).toBe('Opportunity');
			expect(rel.lookup).toBe('campaign');

			expect(rel.aggregators.totalOpportunities).toEqual({ aggregator: 'count' });
			expect(rel.aggregators.newestOpportunity).toEqual({ aggregator: 'first' });
			expect(rel.aggregators.avgValue).toEqual({ aggregator: 'avg', field: 'value' });
		});

		it('should pass round-trip validation', () => {
			const iqr = sqlToIQR(sql);
			const result = validateCrossModuleQuery(iqr);
			expect(result.success).toBe(true);
		});
	});

	describe('RFC Example 6: Contact + Message with MAX + COUNT and multi-condition WHERE', () => {
		const sql = `
			SELECT ct.code, ct.name,
				MAX(m._createdAt) AS lastEmailSentAt,
				COUNT(m._id) AS totalEmailsSent
			FROM Contact ct
			LEFT JOIN Message m ON ct._id = m.contact._id
			WHERE m.type = 'Email'
				AND m.status = 'Enviada'
			GROUP BY ct.code, ct.name
			ORDER BY ct.name ASC
			LIMIT 1000
		`;

		it('should produce a valid IQR', () => {
			const iqr = sqlToIQR(sql);

			expect(iqr.document).toBe('Contact');
			expect(iqr.fields).toBe('code,name');
			expect(iqr.limit).toBe(1000);

			expect(iqr.relations).toHaveLength(1);
			const rel = iqr.relations[0];
			expect(rel.document).toBe('Message');
			expect(rel.lookup).toBe('contact');

			expect(rel.aggregators.lastEmailSentAt).toEqual({ aggregator: 'max', field: '_createdAt' });
			expect(rel.aggregators.totalEmailsSent).toEqual({ aggregator: 'count' });

			expect(rel.filter?.conditions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ term: 'type', operator: 'equals', value: 'Email' }),
					expect.objectContaining({ term: 'status', operator: 'equals', value: 'Enviada' }),
				]),
			);

			expect(iqr.filter).toBeUndefined();
		});

		it('should pass round-trip validation', () => {
			const iqr = sqlToIQR(sql);
			const result = validateCrossModuleQuery(iqr);
			expect(result.success).toBe(true);
		});
	});

	describe('Non-standard aggregates', () => {
		it('should parse PUSH(ppo._id) as push aggregator', () => {
			const sql = `
				SELECT PUSH(ppo._id) AS offers
				FROM Product p
				INNER JOIN ProductsPerOpportunities ppo ON p._id = ppo.product._id
				LIMIT 1
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.relations[0].aggregators.offers).toEqual({ aggregator: 'push' });
		});

		it('should parse FIRST(o._id) as first aggregator', () => {
			const sql = `
				SELECT FIRST(o._id) AS newest
				FROM Campaign c
				INNER JOIN Opportunity o ON c._id = o.campaign._id
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.relations[0].aggregators.newest).toEqual({ aggregator: 'first' });
		});

		it('should parse ADDTOSET(o.status) as addToSet aggregator', () => {
			const sql = `
				SELECT ADDTOSET(o.status) AS statuses
				FROM Contact c
				INNER JOIN Opportunity o ON c._id = o.contact._id
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.relations[0].aggregators.statuses).toEqual({ aggregator: 'addToSet', field: 'status' });
		});

		it('should parse FIRST(o.*) as first aggregator without field', () => {
			const sql = `
				SELECT FIRST(o.*) AS newest
				FROM Campaign c
				INNER JOIN Opportunity o ON c._id = o.campaign._id
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.relations[0].aggregators.newest).toEqual({ aggregator: 'first' });
		});
	});

	describe('OR within same module', () => {
		it('should support OR conditions on same alias', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				WHERE o.status = 'Nova' OR o.status = 'Em Visitacao'
			`;
			const iqr = sqlToIQR(sql);

			expect(iqr.relations[0].filter).toBeDefined();
			const filter = iqr.relations[0].filter!;
			expect(filter.filters).toBeDefined();
			expect(filter.filters!.length).toBeGreaterThan(0);
			expect(filter.filters![0].match).toBe('or');
		});

		it('should throw for cross-module OR', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				WHERE ct.status = 'active' OR o.status = 'Nova'
			`;

			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('OR conditions across different modules are not supported');
		});
	});

	describe('Error handling', () => {
		it('should throw for invalid SQL syntax', () => {
			expect(() => sqlToIQR('SELECTZ bad syntax')).toThrow(SqlParseError);
		});

		it('should throw for unknown table', () => {
			const sql = 'SELECT * FROM UnknownTable ut INNER JOIN Contact c ON ut._id = c.contact._id';
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('Unknown table');
		});

		it('should throw for INSERT (non-SELECT)', () => {
			const sql = "INSERT INTO Contact (name) VALUES ('test')";
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('Only SELECT queries are allowed');
		});

		it('should throw for DROP (non-SELECT)', () => {
			const sql = 'DROP TABLE Contact';
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('Only SELECT queries are allowed');
		});

		it('should throw for HAVING clause', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				GROUP BY ct.code
				HAVING COUNT(o._id) > 5
			`;
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('HAVING');
		});

		it('should throw for UNION', () => {
			const sql = `
				SELECT ct.code FROM Contact ct
				UNION
				SELECT o.code FROM Opportunity o
			`;
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('UNION');
		});

		it('should throw for subquery in WHERE', () => {
			const sql = `
				SELECT ct.code FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				WHERE ct.status IN (SELECT status FROM Campaign)
			`;
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('subquery');
		});

		it('should throw for RIGHT JOIN', () => {
			const sql = `
				SELECT ct.code FROM Contact ct
				RIGHT JOIN Opportunity o ON ct._id = o.contact._id
			`;
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('RIGHT JOIN');
		});

		it('should throw for SQL exceeding max length', () => {
			const sql = 'SELECT ' + 'a'.repeat(10001);
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('maximum length');
		});

		it('should throw for aggregate without AS alias', () => {
			const sql = `
				SELECT COUNT(o._id)
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
			`;
			expect(() => sqlToIQR(sql)).toThrow(SqlParseError);
			expect(() => sqlToIQR(sql)).toThrow('requires an AS alias');
		});
	});

	describe('LIMIT and OFFSET', () => {
		it('should parse LIMIT', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				LIMIT 50
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.limit).toBe(50);
		});

		it('should parse LIMIT with OFFSET', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				LIMIT 50 OFFSET 100
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.limit).toBe(50);
			expect(iqr.start).toBe(100);
		});

		it('should enforce max limit', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				LIMIT 999999
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.limit).toBeLessThanOrEqual(100000);
		});
	});

	describe('ORDER BY', () => {
		it('should parse ORDER BY ASC', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				ORDER BY ct.code ASC
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.sort).toEqual([{ property: 'code', direction: 'ASC' }]);
		});

		it('should parse ORDER BY DESC', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				ORDER BY ct.code DESC
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.sort).toEqual([{ property: 'code', direction: 'DESC' }]);
		});
	});

	describe('WHERE operators', () => {
		it('should parse equals (=)', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				WHERE ct.status = 'active'
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.filter?.conditions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ term: 'status', operator: 'equals', value: 'active' }),
				]),
			);
		});

		it('should parse IN', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				WHERE o.status IN ('Nova', 'Em Visitacao')
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.relations[0].filter?.conditions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ term: 'status', operator: 'in', value: ['Nova', 'Em Visitacao'] }),
				]),
			);
		});

		it('should parse LIKE as contains', () => {
			const sql = `
				SELECT ct.code, COUNT(o._id) AS cnt
				FROM Contact ct
				INNER JOIN Opportunity o ON ct._id = o.contact._id
				WHERE ct.status LIKE '%active%'
			`;
			const iqr = sqlToIQR(sql);
			expect(iqr.filter?.conditions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ term: 'status', operator: 'contains' }),
				]),
			);
		});
	});
});

describe('inferLookupFromJoin', () => {
	beforeEach(setupMetadata);

	it('should infer lookup when left is parent _id and right is child lookup._id', () => {
		const result = inferLookupFromJoin('Contact', '_id', 'Opportunity', 'contact._id');
		expect(result).not.toBeNull();
		expect(result?.parentDocument).toBe('Contact');
		expect(result?.childDocument).toBe('Opportunity');
		expect(result?.lookupField).toBe('contact');
	});

	it('should infer lookup when right is parent _id and left is child lookup._id', () => {
		const result = inferLookupFromJoin('Opportunity', 'contact._id', 'Contact', '_id');
		expect(result).not.toBeNull();
		expect(result?.parentDocument).toBe('Contact');
		expect(result?.childDocument).toBe('Opportunity');
		expect(result?.lookupField).toBe('contact');
	});

	it('should return null for non-matching lookup', () => {
		const result = inferLookupFromJoin('Product', '_id', 'Opportunity', 'contact._id');
		expect(result).toBeNull();
	});
});
