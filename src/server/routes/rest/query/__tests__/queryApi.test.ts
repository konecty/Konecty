import Fastify, { FastifyInstance } from 'fastify';
import { queryApi } from '../queryApi';

jest.mock('@imports/data/api/crossModuleQuery', () => ({
	__esModule: true,
	default: jest.fn().mockResolvedValue({
		success: true,
		meta: { document: 'Contact', relations: ['Opportunity'], warnings: [], executionTimeMs: 42 },
		records: [
			{ code: 1001, name: { full: 'Alice Santos' }, activeOpportunities: 3 },
			{ code: 1002, name: { full: 'Bruno Silva' }, activeOpportunities: 1 },
		],
		total: 2,
	}),
}));

jest.mock('@imports/utils/sessionUtils', () => ({
	getAuthTokenIdFromReq: jest.fn().mockReturnValue('mock-auth-token'),
}));

jest.mock('@imports/model/MetaObject', () => ({
	MetaObject: {
		Meta: {
			Contact: { type: 'document', fields: { code: { type: 'number' }, name: { type: 'personName' }, status: { type: 'text' } } },
			Opportunity: {
				type: 'document',
				fields: {
					code: { type: 'number' },
					contact: { type: 'lookup', document: 'Contact' },
					status: { type: 'text' },
				},
			},
		},
		Collections: {},
		Access: {},
	},
}));

jest.mock('@imports/utils/logger', () => ({
	logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

function buildApp(): FastifyInstance {
	const app = Fastify();
	app.decorateRequest('openTelemetry', (() => ({
		tracer: {
			startSpan: () => ({ end: jest.fn(), setAttribute: jest.fn() }),
		},
	})) as any);
	app.register(queryApi);
	return app;
}

describe('POST /rest/query/sql', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('should return 200 with NDJSON and _meta containing success and total when includeMeta is true', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/sql',
			payload: {
				sql: 'SELECT ct.code, ct.name, COUNT(o._id) AS activeOpportunities FROM Contact ct INNER JOIN Opportunity o ON ct._id = o.contact._id GROUP BY ct.code, ct.name ORDER BY ct.name ASC LIMIT 1000',
				includeTotal: true,
				includeMeta: true,
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers['content-type']).toContain('application/x-ndjson');
		expect(response.headers['x-total-count']).toBe('2');

		const lines = response.body.trim().split('\n');
		expect(lines.length).toBeGreaterThanOrEqual(3);

		const metaLine = JSON.parse(lines[0]);
		expect(metaLine._meta).toBeDefined();
		expect(metaLine._meta.success).toBe(true);
		expect(metaLine._meta.document).toBe('Contact');
		expect(metaLine._meta.total).toBe(2);
	});

	it('should default includeTotal to true and includeMeta to false', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/sql',
			payload: {
				sql: 'SELECT ct.code, COUNT(o._id) AS cnt FROM Contact ct INNER JOIN Opportunity o ON ct._id = o.contact._id',
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers['x-total-count']).toBe('2');

		const lines = response.body.trim().split('\n');
		const firstLine = JSON.parse(lines[0]);
		expect(firstLine._meta).toBeUndefined();
	});

	it('should return 400 with _meta error format for empty sql', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/sql',
			payload: { sql: '' },
		});

		expect(response.statusCode).toBe(400);
		expect(response.headers['content-type']).toContain('application/x-ndjson');

		const body = JSON.parse(response.body.trim());
		expect(body._meta).toBeDefined();
		expect(body._meta.success).toBe(false);
		expect(body._meta.errors).toBeDefined();
	});

	it('should return 400 with _meta error format for missing sql field', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/sql',
			payload: { includeTotal: true },
		});

		expect(response.statusCode).toBe(400);
		const body = JSON.parse(response.body.trim());
		expect(body._meta).toBeDefined();
		expect(body._meta.success).toBe(false);
	});

	it('should return 400 with _meta error format for DROP TABLE (non-SELECT)', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/sql',
			payload: { sql: 'DROP TABLE Contact' },
		});

		expect(response.statusCode).toBe(400);
		const body = JSON.parse(response.body.trim());
		expect(body._meta).toBeDefined();
		expect(body._meta.success).toBe(false);
		expect(body._meta.errors[0].message).toContain('Only SELECT queries are allowed');
	});

	it('should return 400 with _meta error format for unknown table', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/sql',
			payload: {
				sql: 'SELECT * FROM FakeModule fm INNER JOIN Contact c ON fm._id = c.contact._id',
			},
		});

		expect(response.statusCode).toBe(400);
		const body = JSON.parse(response.body.trim());
		expect(body._meta).toBeDefined();
		expect(body._meta.success).toBe(false);
		expect(body._meta.errors[0].message).toContain('Unknown table');
	});

	it('should return 200 with includeMeta=false (no _meta line)', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/sql',
			payload: {
				sql: 'SELECT ct.code, COUNT(o._id) AS cnt FROM Contact ct INNER JOIN Opportunity o ON ct._id = o.contact._id',
				includeMeta: false,
			},
		});

		expect(response.statusCode).toBe(200);
		const lines = response.body.trim().split('\n');
		const firstLine = JSON.parse(lines[0]);
		expect(firstLine._meta).toBeUndefined();
	});
});

describe('POST /rest/query/json', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('should return 200 with NDJSON, no _meta line by default (includeMeta defaults to false)', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/json',
			payload: {
				document: 'Contact',
				relations: [
					{
						document: 'Opportunity',
						lookup: 'contact',
						aggregators: { count: { aggregator: 'count' } },
					},
				],
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers['content-type']).toContain('application/x-ndjson');

		const lines = response.body.trim().split('\n');
		const firstLine = JSON.parse(lines[0]);
		expect(firstLine._meta).toBeUndefined();
	});

	it('should return _meta line with success and total when includeMeta is true', async () => {
		const response = await app.inject({
			method: 'POST',
			url: '/rest/query/json',
			payload: {
				document: 'Contact',
				includeMeta: true,
				relations: [
					{
						document: 'Opportunity',
						lookup: 'contact',
						aggregators: { count: { aggregator: 'count' } },
					},
				],
			},
		});

		expect(response.statusCode).toBe(200);
		const lines = response.body.trim().split('\n');
		const metaLine = JSON.parse(lines[0]);
		expect(metaLine._meta).toBeDefined();
		expect(metaLine._meta.success).toBe(true);
		expect(metaLine._meta.document).toBe('Contact');
		expect(metaLine._meta.total).toBe(2);
	});
});
