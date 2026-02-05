import { expect } from 'chai';
import { Readable } from 'node:stream';
import findStream from '../../../src/imports/data/api/findStream';
import { login } from '../../utils/login';
import { db } from '@imports/database';

	const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
	const TEST_TOKEN = process.env.TEST_TOKEN;
	const USE_EXTERNAL_SERVER = !!TEST_TOKEN || !!process.env.USE_EXTERNAL_SERVER;

async function createProductHelper(authId: string) {
	const requiredFields = {
		name: 'Teste',
		status: 'draft',
	};
	const data = (await fetch(`${SERVER_URL}/rest/data/Product`, {
		method: 'POST',
		headers: {
			Cookie: `_authTokenId=${authId}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requiredFields),
	}).then(res => res.json())) as any;

	return data.data?.[0];
}

async function checkServerAvailable(): Promise<boolean> {
	try {
		const response = await fetch(`${SERVER_URL}/rest/health`, {
			method: 'GET',
		});
		return response.ok;
	} catch {
		return false;
	}
}

describe('findStream', () => {
	// Use provided token if available, otherwise use fake login
	const authId = TEST_TOKEN || login('admin-test');
	let product: { _id: string } = {
		_id: '',
	};
	let serverAvailable = false;

	before(async function() {
		this.timeout(5000);
		if (USE_EXTERNAL_SERVER) {
			// When using external server, check if it's available
			serverAvailable = await checkServerAvailable();
			if (!serverAvailable) {
				console.warn('⚠️  Server not available at', SERVER_URL, ', some tests may be skipped');
			} else {
				console.log('✅ Using external server at', SERVER_URL);
			}
		} else {
			// When using Jest globalSetup, server should be started by it
			// Wait a bit for it to start
			await new Promise(resolve => setTimeout(resolve, 3000));
			serverAvailable = await checkServerAvailable();
		}
	});

	beforeEach(async function() {
		if (!serverAvailable) {
			this.skip();
		}
		product = (await createProductHelper(authId)) as { _id: string };
	});

	afterEach(async function() {
		if (!serverAvailable) {
			return;
		}
		try {
			await db.collection('data.Product').deleteMany({});
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should return error when buildFindQuery fails', async function() {
		if (!serverAvailable) {
			this.skip();
		}

		const result = await findStream({
			document: 'NonExistentDocument',
			authTokenId: 'invalid-token',
		});

		expect(result.success).to.be.false;
		if (!result.success) {
			expect(result.errors).to.be.an('array');
		}
	});

	it('should return Readable stream when successful', async function() {
		if (!serverAvailable) {
			this.skip();
		}

		const result = await findStream({
			document: 'Product',
			authTokenId: authId,
			limit: 10,
		});

		if (!result.success) {
			console.log('findStream error:', JSON.stringify(result.errors, null, 2));
		}
		expect(result.success).to.be.true;
		if (result.success) {
			expect(result.data).to.be.instanceOf(Readable);
		}
	});

	it('should apply Transform streams correctly', async function() {
		if (!serverAvailable) {
			this.skip();
		}

		const result = await findStream({
			document: 'Product',
			authTokenId: authId,
			limit: 5,
			transformDatesToString: true,
		});

		expect(result.success).to.be.true;
		if (result.success) {
			const records: any[] = [];
			const stream = result.data;

			await new Promise<void>((resolve, reject) => {
				stream.on('data', (record: any) => {
					records.push(record);
				});

				stream.on('end', () => {
					resolve();
				});

				stream.on('error', reject);
			});

			expect(records.length).to.be.greaterThan(0);
		}
	});

	it('should calculate total in parallel when getTotal is true', async function() {
		if (!serverAvailable) {
			this.skip();
		}

		const result = await findStream({
			document: 'Product',
			authTokenId: authId,
			limit: 10,
			getTotal: true,
		});

		expect(result.success).to.be.true;
		if (result.success) {
			// Wait a bit for total to be calculated
			await new Promise(resolve => setTimeout(resolve, 100));
			// Total might be undefined initially, but should be calculated asynchronously
			expect(result).to.have.property('total');
		}
	});

	it('should handle transformDatesToString option', async function() {
		if (!serverAvailable) {
			this.skip();
		}

		const resultWithTransform = await findStream({
			document: 'Product',
			authTokenId: authId,
			limit: 5,
			transformDatesToString: true,
		});

		const resultWithoutTransform = await findStream({
			document: 'Product',
			authTokenId: authId,
			limit: 5,
			transformDatesToString: false,
		});

		expect(resultWithTransform.success).to.be.true;
		expect(resultWithoutTransform.success).to.be.true;
	});

	it('should process records one by one without accumulating', async function() {
		if (!serverAvailable) {
			this.skip();
		}

		const result = await findStream({
			document: 'Product',
			authTokenId: authId,
			limit: 100,
		});

		expect(result.success).to.be.true;
		if (result.success) {
			let maxConcurrentRecords = 0;
			let currentRecords = 0;
			const stream = result.data;

			await new Promise<void>((resolve, reject) => {
				stream.on('data', () => {
					currentRecords++;
					maxConcurrentRecords = Math.max(maxConcurrentRecords, currentRecords);
					// Simulate processing delay
					setTimeout(() => {
						currentRecords--;
					}, 10);
				});

				stream.on('end', () => {
					resolve();
				});

				stream.on('error', reject);
			});

			// Should process records one at a time (maxConcurrentRecords should be low)
			expect(maxConcurrentRecords).to.be.lessThan(10);
		}
	});

	it('should handle errors gracefully', async function() {
		if (!serverAvailable) {
			this.skip();
		}

		// This test would require more complex mocking
		// For now, we test that errors are returned properly
		const result = await findStream({
			document: 'InvalidDocument',
			authTokenId: authId,
		});

		expect(result.success).to.be.false;
	});
});

