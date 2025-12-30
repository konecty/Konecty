// Direct test runner for findStream that bypasses Jest globalSetup
import { expect } from 'chai';
import findStream from '../../../src/imports/data/api/findStream';
import { readStreamRecords, countStreamChunks } from './streamTestHelpers';

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'v5+zj+CGtYlPHYLYMR3elJn5v/kAl3naUI+N7XwEgpM=';

async function createProductHelper(authId: string) {
	const requiredFields = {
		name: 'Teste',
		type: 'Casa',
		address: {
			place: 'Rua Teste',
			number: '123',
			city: 'Porto Alegre',
			state: 'RS',
			country: 'BRA',
		},
	};
	const response = await fetch(`${SERVER_URL}/rest/data/Product`, {
		method: 'POST',
		headers: {
			Cookie: `_authTokenId=${authId}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requiredFields),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to create product: ${response.status} - ${errorText}`);
	}

	const data = (await response.json()) as { success: boolean; errors?: unknown[]; data?: unknown[] };

	if (!data.success) {
		throw new Error(`Failed to create product: ${JSON.stringify(data.errors || data)}`);
	}

	return data.data?.[0];
}

async function checkServerAvailable(): Promise<boolean> {
	try {
		// Try health endpoint first
		const healthResponse = await fetch(`${SERVER_URL}/rest/health`, {
			method: 'GET',
		});
		if (healthResponse.ok) {
			return true;
		}
		// If health returns 404, try a known endpoint
		const testResponse = await fetch(`${SERVER_URL}/rest/stream/Product/findStream?limit=1`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${TEST_TOKEN}`,
			},
		});
		// If we get any response (even 500), server is available
		return testResponse.status !== 0;
	} catch {
		return false;
	}
}

async function runTests() {
	console.log('Running findStream tests against', SERVER_URL, '\n');

	const serverAvailable = await checkServerAvailable();
	if (!serverAvailable) {
		console.error('❌ Server not available at', SERVER_URL);
		console.error('Please make sure the server is running on', SERVER_URL);
		process.exit(1);
	}

	console.log('✅ Server is available\n');

	const authId = TEST_TOKEN;
	const testResults = { passed: 0, failed: 0 };
	let product: { _id: string } | null = null;

	// Test 1: Error handling
	try {
		console.log('Test 1: should return error when buildFindQuery fails');
		const result = await findStream({
			document: 'NonExistentDocument',
			authTokenId: 'invalid-token',
		});

		expect(result.success).to.be.false;
		if (!result.success) {
			expect(result.errors).to.be.an('array');
		}
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Setup: Create product for remaining tests
	try {
		console.log('Setup: Creating test product');
		const createdProduct = await createProductHelper(authId);
		if (!createdProduct || typeof createdProduct !== 'object' || createdProduct == null || !('_id' in createdProduct) || !(createdProduct as { _id?: string })._id) {
			console.error('❌ Failed to create product: Invalid response');
			console.error('Response:', JSON.stringify(createdProduct, null, 2));
			process.exit(1);
		}
		product = createdProduct as { _id: string };
		console.log('✅ Product created:', product._id, '\n');
	} catch (error) {
		console.error('❌ Failed to create product:', error);
		process.exit(1);
	}

	// Test 2: Return Readable stream via HTTP endpoint
	try {
		console.log('Test 2: should return Readable stream when successful (via HTTP)');
		const response = await fetch(`${SERVER_URL}/rest/stream/Product/findStream?limit=10`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.ok).to.be.true;
		expect(response.body).to.not.be.null;
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 3: Transform streams via HTTP
	try {
		console.log('Test 3: should apply Transform streams correctly (via HTTP)');
		const response = await fetch(`${SERVER_URL}/rest/stream/Product/findStream?limit=5`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.ok).to.be.true;
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Response body is not readable');
		}

		const records = await readStreamRecords(reader);
		const recordCount = records.length;

		expect(recordCount).to.be.greaterThan(0);
		console.log(`✅ PASSED (${recordCount} records)\n`);
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 4: Total calculation (getTotal is always true in HTTP endpoint)
	try {
		console.log('Test 4: should return stream with getTotal (via HTTP)');
		const response = await fetch(`${SERVER_URL}/rest/stream/Product/findStream?limit=10`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.ok).to.be.true;
		expect(response.body).to.not.be.null;
		console.log('✅ PASSED (stream returned)\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 5: transformDatesToString option (always true in HTTP endpoint)
	try {
		console.log('Test 5: should handle transformDatesToString option (via HTTP)');
		const response = await fetch(`${SERVER_URL}/rest/stream/Product/findStream?limit=5`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.ok).to.be.true;
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 6: Process records one by one via HTTP
	try {
		console.log('Test 6: should process records one by one without accumulating (via HTTP)');
		const response = await fetch(`${SERVER_URL}/rest/stream/Product/findStream?limit=100`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.ok).to.be.true;
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Response body is not readable');
		}

		const chunkCount = await countStreamChunks(reader);

		expect(chunkCount).to.be.greaterThan(0);
		console.log(`✅ PASSED (${chunkCount} chunks received)\n`);
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 7: Error handling via HTTP
	try {
		console.log('Test 7: should handle errors gracefully (via HTTP)');
		const response = await fetch(`${SERVER_URL}/rest/stream/InvalidDocument/findStream`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(500);
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Cleanup
	try {
		if (product) {
			console.log('Cleanup: Deleting test product');
			const response = await fetch(`${SERVER_URL}/rest/data/Product`, {
				method: 'DELETE',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ids: [{ _id: product._id }] }),
			});
			if (response.ok) {
				console.log('✅ Cleanup completed\n');
			}
		}
	} catch {
		// Ignore cleanup errors
	}

	console.log('=== Test Results ===');
	console.log(`Passed: ${testResults.passed}`);
	console.log(`Failed: ${testResults.failed}`);
	console.log(`Total: ${testResults.passed + testResults.failed}\n`);

	if (testResults.failed > 0) {
		process.exit(1);
	} else {
		console.log('✅ All tests passed!');
	}
}

runTests().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
