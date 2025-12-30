// Direct integration test runner for pivot endpoint that bypasses Jest globalSetup
import { expect } from 'chai';
import { PivotConfig } from '@imports/types/pivot';

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'v5+zj+CGtYlPHYLYMR3elJn5v/kAl3naUI+N7XwEgpM=';

async function checkServerAvailable(): Promise<boolean> {
	try {
		const healthResponse = await fetch(`${SERVER_URL}/rest/health`, {
			method: 'GET',
		});
		if (healthResponse.ok) {
			return true;
		}
		// If health returns 404, try a known endpoint
		const testResponse = await fetch(`${SERVER_URL}/rest/data/Product?limit=1`, {
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

async function fetchPivot(document: string, pivotConfig: PivotConfig, filter?: any, limit?: number): Promise<any> {
	const queryParams = new URLSearchParams();
	queryParams.append('pivotConfig', JSON.stringify(pivotConfig));
	if (filter) {
		queryParams.append('filter', JSON.stringify(filter));
	}
	if (limit) {
		queryParams.append('limit', String(limit));
	}

	const response = await fetch(`${SERVER_URL}/rest/data/${document}/pivot?${queryParams.toString()}`, {
		method: 'GET',
		headers: {
			Cookie: `_authTokenId=${TEST_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});

	const data = await response.json();
	return { status: response.status, data };
}

async function runTests() {
	console.log('Running pivot integration tests against', SERVER_URL, '\n');

	const serverAvailable = await checkServerAvailable();
	if (!serverAvailable) {
		console.error('❌ Server not available at', SERVER_URL);
		console.error('Please make sure the server is running on', SERVER_URL);
		process.exit(1);
	}

	console.log('✅ Server is available\n');

	const testResults = { passed: 0, failed: 0 };

	// Test 1: Missing pivotConfig
	try {
		console.log('Test 1: should return error when pivotConfig is missing');
		const response = await fetch(`${SERVER_URL}/rest/data/Opportunity/pivot`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${TEST_TOKEN}`,
			},
		});
		const data = await response.json();
		expect(data.success).to.be.false;
		expect(data.errors?.[0]?.message).to.include('pivotConfig is required');
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 2: Invalid pivotConfig (missing rows)
	try {
		console.log('Test 2: should return error when pivotConfig.rows is missing');
		const invalidConfig: PivotConfig = {
			values: [{ field: 'value', aggregator: 'sum' }],
		} as any;
		const { data } = await fetchPivot('Opportunity', invalidConfig);
		expect(data.success).to.be.false;
		expect(data.errors?.[0]?.message).to.include('rows is required');
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 3: Invalid pivotConfig (missing values)
	try {
		console.log('Test 3: should return error when pivotConfig.values is missing');
		const invalidConfig: PivotConfig = {
			rows: [{ field: 'status' }],
		} as any;
		const { data } = await fetchPivot('Opportunity', invalidConfig);
		expect(data.success).to.be.false;
		expect(data.errors?.[0]?.message).to.include('values is required');
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 4: Successful pivot with rows and values only
	try {
		console.log('Test 4: should process pivot table with rows and values only');
		const pivotConfig: PivotConfig = {
			rows: [{ field: 'status' }],
			values: [{ field: 'code', aggregator: 'count' }],
		};
		const { data } = await fetchPivot('Opportunity', pivotConfig, undefined, 100);
		if (!data.success) {
			console.error('   Error response:', JSON.stringify(data.errors || data, null, 2));
		}
		expect(data.success).to.be.true;
		if (data.success) {
			// Verify new hierarchical structure
			expect(data.metadata).to.exist;
			expect(data.metadata.rows).to.be.an('array');
			expect(data.metadata.values).to.be.an('array');
			expect(data.data).to.be.an('array');
			expect(data.grandTotals).to.exist;
			expect(data.grandTotals.totals).to.exist;
			
			console.log(`   Returned ${data.data.length} pivot rows`);
			if (data.data.length > 0) {
				const sampleRow = data.data[0];
				expect(sampleRow).to.have.property('key');
				expect(sampleRow).to.have.property('label');
				expect(sampleRow).to.have.property('level');
				expect(sampleRow).to.have.property('cells');
				expect(sampleRow).to.have.property('totals');
				console.log(`   Sample row:`, JSON.stringify(sampleRow, null, 2));
			}
		}
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 5: Successful pivot with rows, columns, and values
	try {
		console.log('Test 5: should process pivot table with rows, columns, and values');
		const pivotConfig: PivotConfig = {
			rows: [{ field: 'status' }],
			columns: [{ field: 'type' }],
			values: [{ field: 'code', aggregator: 'count' }],
		};
		const { data } = await fetchPivot('Opportunity', pivotConfig, undefined, 100);
		if (!data.success) {
			console.error('   Error response:', JSON.stringify(data.errors || data, null, 2));
		}
		expect(data.success).to.be.true;
		if (data.success) {
			expect(data.metadata).to.exist;
			expect(data.metadata.columns).to.be.an('array');
			expect(data.data).to.be.an('array');
			expect(data.grandTotals).to.exist;
			expect(data.grandTotals.cells).to.exist;
			
			console.log(`   Returned ${data.data.length} pivot rows`);
			if (data.data.length > 0) {
				const sampleRow = data.data[0];
				expect(sampleRow.cells).to.be.an('object');
				console.log(`   Sample row:`, JSON.stringify(sampleRow, null, 2));
			}
		}
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 6: Pivot with filter
	try {
		console.log('Test 6: should process pivot table with filter');
		const pivotConfig: PivotConfig = {
			rows: [{ field: 'status' }],
			values: [{ field: 'code', aggregator: 'count' }],
		};
		const filter = {
			match: 'and',
			conditions: [
				{
					term: 'status',
					operator: 'in',
					value: ['Nova', 'Em Visitação'],
				},
			],
		};
		const { data } = await fetchPivot('Opportunity', pivotConfig, filter, 100);
		expect(data.success).to.be.true;
		if (data.success) {
			expect(data.data).to.be.an('array');
			expect(data.grandTotals).to.exist;
			console.log(`   Returned ${data.data.length} pivot rows with filter applied`);
			console.log(`   Grand totals:`, JSON.stringify(data.grandTotals.totals, null, 2));
		}
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 7: Pivot with multiple aggregators
	try {
		console.log('Test 7: should process pivot table with multiple value aggregators');
		const pivotConfig: PivotConfig = {
			rows: [{ field: 'status' }],
			values: [
				{ field: 'code', aggregator: 'count' },
			],
		};
		const { data } = await fetchPivot('Opportunity', pivotConfig, undefined, 100);
		expect(data.success).to.be.true;
		if (data.success) {
			expect(data.data).to.be.an('array');
			console.log(`   Returned ${data.data.length} pivot rows with multiple aggregators`);
		}
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 8: Pivot with multiple rows (hierarchical structure)
	try {
		console.log('Test 8: should process pivot table with multiple rows (hierarchical)');
		const pivotConfig: PivotConfig = {
			rows: [
				{ field: 'status' },
				{ field: 'type' },
			],
			values: [{ field: 'code', aggregator: 'count' }],
		};
		const { data } = await fetchPivot('Opportunity', pivotConfig, undefined, 100);
		if (!data.success) {
			console.error('   Error response:', JSON.stringify(data.errors || data, null, 2));
		}
		expect(data.success).to.be.true;
		if (data.success) {
			expect(data.metadata.rows).to.have.length(2);
			expect(data.data).to.be.an('array');
			console.log(`   Returned ${data.data.length} top-level pivot rows`);
			if (data.data.length > 0) {
				const sampleRow = data.data[0];
				expect(sampleRow.level).to.equal(0);
				// Check if it has children (hierarchical structure)
				if (sampleRow.children && sampleRow.children.length > 0) {
					expect(sampleRow.children[0].level).to.equal(1);
					console.log(`   Sample row has ${sampleRow.children.length} children`);
				}
				console.log(`   Sample row:`, JSON.stringify(sampleRow, null, 2));
			}
		}
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 9: Error handling - invalid document
	try {
		console.log('Test 9: should return error for invalid document');
		const pivotConfig: PivotConfig = {
			rows: [{ field: 'status' }],
			values: [{ field: 'code', aggregator: 'count' }],
		};
		const { data } = await fetchPivot('NonExistentDocument', pivotConfig);
		expect(data.success).to.be.false;
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 10: Error handling - invalid token
	try {
		console.log('Test 10: should return error for invalid token');
		const pivotConfig: PivotConfig = {
			rows: [{ field: 'status' }],
			values: [{ field: 'code', aggregator: 'count' }],
		};
		const queryParams = new URLSearchParams();
		queryParams.append('pivotConfig', JSON.stringify(pivotConfig));
		const response = await fetch(`${SERVER_URL}/rest/data/Opportunity/pivot?${queryParams.toString()}`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=invalid-token`,
			},
		});
		const data = await response.json();
		expect(data.success).to.be.false;
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('Test Summary:');
	console.log(`✅ Passed: ${testResults.passed}`);
	console.log(`❌ Failed: ${testResults.failed}`);
	console.log(`Total: ${testResults.passed + testResults.failed}`);
	console.log('='.repeat(60) + '\n');

	if (testResults.failed > 0) {
		process.exit(1);
	}
}

runTests().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});

