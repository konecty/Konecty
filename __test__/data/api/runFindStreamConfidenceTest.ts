// Confidence test: Compare findStream results with original find (paginated)
// Ensures both endpoints return exactly the same records and data
// Executes directly in Node

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'CupITXzG8fdfqGgwtV5j4PC5aFXrk8lz/2eW7JhwqvA=';

type TestResult = {
	success: boolean;
	message: string;
	details?: any;
};

async function fetchFindPaginated(document: string, filter: string, limit?: number): Promise<any> {
	const url = limit
		? `${SERVER_URL}/rest/data/${document}/find?filter=${encodeURIComponent(filter)}&limit=${limit}`
		: `${SERVER_URL}/rest/data/${document}/find?filter=${encodeURIComponent(filter)}`;

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			Cookie: `_authTokenId=${TEST_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Find paginated failed: ${response.status} ${response.statusText}`);
	}

	return await response.json();
}

async function fetchFindStream(document: string, filter: string, limit?: number): Promise<any[]> {
	const url = limit
		? `${SERVER_URL}/rest/stream/${document}/findStream?filter=${encodeURIComponent(filter)}&limit=${limit}`
		: `${SERVER_URL}/rest/stream/${document}/findStream?filter=${encodeURIComponent(filter)}`;

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			Cookie: `_authTokenId=${TEST_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`FindStream failed: ${response.status} ${response.statusText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('Response body is not readable');
	}

	const decoder = new TextDecoder();
	let buffer = '';
	const records: any[] = [];

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		if (value) {
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.trim()) {
					try {
						const record = JSON.parse(line);
						records.push(record);
					} catch (error) {
						// Not a complete JSON record yet, keep in buffer
					}
				}
			}
		}
	}

	// Process any remaining buffer
	if (buffer.trim()) {
		try {
			const record = JSON.parse(buffer.trim());
			records.push(record);
		} catch {
			// Ignore incomplete JSON
		}
	}

	return records;
}

function normalizeRecord(record: any): any {
	// Create a normalized version for comparison
	// Sort keys for consistent comparison
	const normalized: any = {};
	const sortedKeys = Object.keys(record).sort();

	for (const key of sortedKeys) {
		normalized[key] = record[key];
	}

	return normalized;
}

function compareRecords(findRecords: any[], streamRecords: any[]): TestResult {
	// Check record count
	if (findRecords.length !== streamRecords.length) {
		return {
			success: false,
			message: `Record count mismatch: find=${findRecords.length}, stream=${streamRecords.length}`,
			details: {
				findCount: findRecords.length,
				streamCount: streamRecords.length,
			},
		};
	}

	// Create maps by _id for easier comparison
	const findMap = new Map<string, any>();
	const streamMap = new Map<string, any>();

	for (const record of findRecords) {
		if (record._id) {
			findMap.set(String(record._id), normalizeRecord(record));
		}
	}

	for (const record of streamRecords) {
		if (record._id) {
			streamMap.set(String(record._id), normalizeRecord(record));
		}
	}

	// Check if all IDs match
	const findIds = Array.from(findMap.keys()).sort();
	const streamIds = Array.from(streamMap.keys()).sort();

	if (findIds.length !== streamIds.length) {
		return {
			success: false,
			message: `ID count mismatch: find=${findIds.length}, stream=${streamIds.length}`,
		};
	}

	const missingInStream: string[] = [];
	const missingInFind: string[] = [];
	const differentRecords: Array<{ id: string; differences: string[] }> = [];

	for (const id of findIds) {
		if (!streamMap.has(id)) {
			missingInStream.push(id);
		}
	}

	for (const id of streamIds) {
		if (!findMap.has(id)) {
			missingInFind.push(id);
		}
	}

	if (missingInStream.length > 0 || missingInFind.length > 0) {
		return {
			success: false,
			message: `ID mismatch: missing in stream=${missingInStream.length}, missing in find=${missingInFind.length}`,
			details: {
				missingInStream: missingInStream.slice(0, 10), // Show first 10
				missingInFind: missingInFind.slice(0, 10),
			},
		};
	}

	// Compare record content
	let comparedCount = 0;
	for (const id of findIds) {
		const findRecord = findMap.get(id);
		const streamRecord = streamMap.get(id);

		if (!findRecord || !streamRecord) {
			continue;
		}

		comparedCount++;
		const differences: string[] = [];

		// Compare all fields
		const allKeys = new Set([...Object.keys(findRecord), ...Object.keys(streamRecord)]);

		for (const key of allKeys) {
			const findValue = findRecord[key];
			const streamValue = streamRecord[key];

			// Deep comparison using JSON.stringify for complex objects
			const findStr = JSON.stringify(findValue);
			const streamStr = JSON.stringify(streamValue);

			if (findStr !== streamStr) {
				// Show first difference for debugging
				if (differences.length === 0) {
					differences.push(
						`${key}: find=${findStr.substring(0, 100)}... vs stream=${streamStr.substring(0, 100)}...`,
					);
				} else {
					differences.push(key);
				}
			}
		}

		if (differences.length > 0) {
			differentRecords.push({ id, differences });
		}
	}

	if (differentRecords.length > 0) {
		return {
			success: false,
			message: `${differentRecords.length} records have different field values`,
			details: {
				differentRecords: differentRecords.slice(0, 10), // Show first 10
				totalDifferent: differentRecords.length,
			},
		};
	}

	// Sample a record for verification display
	const sampleId = findIds.length > 0 ? findIds[0] : null;
	const sampleFind = sampleId ? findMap.get(sampleId) : null;
	const sampleStream = sampleId ? streamMap.get(sampleId) : null;

	return {
		success: true,
		message: `All ${findRecords.length} records match exactly (${comparedCount} compared)`,
		details: {
			recordCount: findRecords.length,
			comparedCount,
			sampleRecordId: sampleId,
			sampleFieldsCount: sampleFind ? Object.keys(sampleFind).length : 0,
		},
	};
}

async function runConfidenceTest(document: string, filter: string, limit?: number): Promise<TestResult> {
	try {
		console.log(`\nFetching find paginated (limit=${limit || 'none'})...`);
		const findResult = await fetchFindPaginated(document, filter, limit);

		if (!findResult.success) {
			return {
				success: false,
				message: `Find paginated returned error: ${JSON.stringify(findResult.errors)}`,
			};
		}

		const findRecords = Array.isArray(findResult.data) ? findResult.data : [];
		console.log(`✅ Find paginated: ${findRecords.length} records (total: ${findResult.total || 'N/A'})`);

		console.log(`Fetching findStream (limit=${limit || 'none'})...`);
		const streamRecords = await fetchFindStream(document, filter, limit);
		console.log(`✅ FindStream: ${streamRecords.length} records`);

		if (findRecords.length === 0 && streamRecords.length === 0) {
			return {
				success: true,
				message: 'Both endpoints returned 0 records (no data to compare)',
			};
		}

		console.log('Comparing records (validating all fields match exactly)...');
		const comparison = compareRecords(findRecords, streamRecords);

		if (comparison.success && comparison.details?.sampleRecordId) {
			const sampleId = comparison.details.sampleRecordId;
			const findSample = findRecords.find((r: any) => String(r._id) === sampleId);
			const streamSample = streamRecords.find((r: any) => String(r._id) === sampleId);
			if (findSample && streamSample) {
				console.log(`  Sample record ${sampleId}: ${comparison.details.sampleFieldsCount} fields validated`);
			}
		}

		return comparison;
	} catch (error) {
		return {
			success: false,
			message: `Test failed with error: ${(error as Error).message}`,
			details: { error: String(error) },
		};
	}
}

async function runAllTests() {
	console.log('Running Confidence Tests: findStream vs Find Paginated');
	console.log(`Server: ${SERVER_URL}`);
	console.log(`Token: ${TEST_TOKEN.substring(0, 20)}...\n`);

	// Check server availability
	try {
		const healthResponse = await fetch(`${SERVER_URL}/rest/health`, {
			method: 'GET',
		});
		if (!healthResponse.ok) {
			// Try a known endpoint
			const testResponse = await fetch(`${SERVER_URL}/rest/data/Opportunity/find?limit=1`, {
				method: 'GET',
				headers: {
					Cookie: `_authTokenId=${TEST_TOKEN}`,
				},
			});
			if (testResponse.status === 0) {
				throw new Error('Server not accessible');
			}
		}
		console.log('✅ Server is available\n');
	} catch {
		console.error('❌ Server not available at', SERVER_URL);
		process.exit(1);
	}

	const filter = JSON.stringify({
		match: 'and',
		conditions: [
			{
				term: 'status',
				operator: 'in',
				value: ['Em Visitação', 'Nova', 'Ofertando Imóveis', 'Proposta', 'Contrato'],
			},
		],
	});

	const document = 'Opportunity';

	let allPassed = true;
	const results: Array<{ test: string; result: TestResult }> = [];

	// Test 1: Small dataset (100 records)
	console.log('='.repeat(60));
	console.log('Test 1: Small dataset (100 records)');
	console.log('='.repeat(60));
	const test1 = await runConfidenceTest(document, filter, 100);
	results.push({ test: 'Small dataset (100)', result: test1 });
	if (test1.success) {
		console.log(`✅ PASSED: ${test1.message}\n`);
	} else {
		console.error(`❌ FAILED: ${test1.message}`);
		if (test1.details) {
			console.error('Details:', JSON.stringify(test1.details, null, 2));
		}
		console.error('');
		allPassed = false;
	}

	// Test 2: Medium dataset (1000 records)
	console.log('='.repeat(60));
	console.log('Test 2: Medium dataset (1000 records)');
	console.log('='.repeat(60));
	const test2 = await runConfidenceTest(document, filter, 1000);
	results.push({ test: 'Medium dataset (1000)', result: test2 });
	if (test2.success) {
		console.log(`✅ PASSED: ${test2.message}\n`);
	} else {
		console.error(`❌ FAILED: ${test2.message}`);
		if (test2.details) {
			console.error('Details:', JSON.stringify(test2.details, null, 2));
		}
		console.error('');
		allPassed = false;
	}

	// Test 3: Large dataset (5000 records)
	console.log('='.repeat(60));
	console.log('Test 3: Large dataset (5000 records)');
	console.log('='.repeat(60));
	const test3 = await runConfidenceTest(document, filter, 5000);
	results.push({ test: 'Large dataset (5000)', result: test3 });
	if (test3.success) {
		console.log(`✅ PASSED: ${test3.message}\n`);
	} else {
		console.error(`❌ FAILED: ${test3.message}`);
		if (test3.details) {
			console.error('Details:', JSON.stringify(test3.details, null, 2));
		}
		console.error('');
		allPassed = false;
	}

	// Test 4: Full dataset (all ~55k records)
	console.log('='.repeat(60));
	console.log('Test 4: Full dataset (all records, ~55k)');
	console.log('='.repeat(60));
	console.log('⚠️  This may take several minutes...\n');

	// First get total count
	let totalCount = 0;
	try {
		const countResult = await fetchFindPaginated(document, filter, 1);
		totalCount = countResult.total || 0;
		console.log(`Total records: ${totalCount.toLocaleString()}\n`);
	} catch (error) {
		console.error('Failed to get total count:', error);
		allPassed = false;
	}

	if (totalCount > 0) {
		const test4 = await runConfidenceTest(document, filter, totalCount);
		results.push({ test: `Full dataset (${totalCount})`, result: test4 });
		if (test4.success) {
			console.log(`✅ PASSED: ${test4.message}\n`);
		} else {
			console.error(`❌ FAILED: ${test4.message}`);
			if (test4.details) {
				console.error('Details:', JSON.stringify(test4.details, null, 2));
			}
			console.error('');
			allPassed = false;
		}
	}

	// Summary
	console.log('='.repeat(60));
	console.log('SUMMARY');
	console.log('='.repeat(60));
	for (const { test, result } of results) {
		const status = result.success ? '✅ PASSED' : '❌ FAILED';
		console.log(`${status}: ${test} - ${result.message}`);
	}

	console.log('\n' + '='.repeat(60));
	if (allPassed) {
		console.log('✅ All confidence tests passed!');
		console.log('✅ findStream returns exactly the same data as find paginated');
	} else {
		console.error('❌ Some confidence tests failed!');
		console.error('❌ findStream does not match find paginated results');
		process.exit(1);
	}
}

runAllTests().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});

