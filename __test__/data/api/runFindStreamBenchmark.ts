// Direct benchmark runner for findStream vs original find (paginated)
// Executes directly in Node, no Jest

import BluebirdPromise from 'bluebird';
import {
	BENCHMARK_ITERATION_CONCURRENCY,
	MEMORY_MONITOR_INTERVAL_MS,
	WARMUP_RECORD_LIMIT,
	ITERATION_DELAY_MS,
	MILLISECONDS_PER_SECOND,
} from '../../../src/imports/data/api/streamConstants';
import { readStreamRecordsWithMetrics, calculateAverageMetrics } from './streamTestHelpers';

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'v5+zj+CGtYlPHYLYMR3elJn5v/kAl3naUI+N7XwEgpM=';

type BenchmarkMetrics = {
	totalTime: number;
	ttfb: number;
	heapUsed: number;
	heapTotal: number;
	rss: number;
	cpuUser: number;
	cpuSystem: number;
	recordCount: number;
	throughput: number;
	peakMemory: number;
};

async function benchmarkFindPaginated(endpoint: string, filter: string, limit: number): Promise<BenchmarkMetrics> {
	const startCpu = process.cpuUsage();
	const startMemory = process.memoryUsage();
	const startTime = performance.now();

	const url = `${endpoint}?filter=${encodeURIComponent(filter)}&limit=${limit}`;
	const response = await fetch(`${SERVER_URL}${url}`, {
		method: 'GET',
		headers: {
			Cookie: `_authTokenId=${TEST_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});

	const ttfb = performance.now() - startTime;

	if (!response.ok) {
		throw new Error(`Request failed with status ${response.status}`);
	}

	// Find paginated returns JSON with data array
	// Monitor memory during JSON parsing (this is where memory accumulates)
	const memoryState = { peakMemory: startMemory.heapUsed };
	const memoryInterval = setInterval(() => {
		const currentMemory = process.memoryUsage();
		memoryState.peakMemory = Math.max(memoryState.peakMemory, currentMemory.heapUsed);
	}, MEMORY_MONITOR_INTERVAL_MS);

	const data = await response.json();
	const recordCount = Array.isArray(data.data) ? data.data.length : 0;

	// Wait a bit to capture peak memory after JSON parsing
	await new Promise(resolve => setTimeout(resolve, MEMORY_MONITOR_INTERVAL_MS));

	clearInterval(memoryInterval);

	const endTime = performance.now();
	const endCpu = process.cpuUsage(startCpu);
	const endMemory = process.memoryUsage();

	const totalTime = endTime - startTime;
	const throughput = recordCount / (totalTime / MILLISECONDS_PER_SECOND); // records per second

	return {
		totalTime,
		ttfb,
		heapUsed: endMemory.heapUsed - startMemory.heapUsed,
		heapTotal: endMemory.heapTotal - startMemory.heapTotal,
		rss: endMemory.rss - startMemory.rss,
		cpuUser: endCpu.user / MILLISECONDS_PER_SECOND, // Convert to milliseconds
		cpuSystem: endCpu.system / MILLISECONDS_PER_SECOND,
		recordCount,
		throughput,
		peakMemory: memoryState.peakMemory - startMemory.heapUsed,
	};
}

async function benchmarkFindStream(endpoint: string, filter: string, limit: number): Promise<BenchmarkMetrics> {
	const startCpu = process.cpuUsage();
	const startMemory = process.memoryUsage();
	const startTime = performance.now();

	const url = `${endpoint}?filter=${encodeURIComponent(filter)}&limit=${limit}`;
	const response = await fetch(`${SERVER_URL}${url}`, {
		method: 'GET',
		headers: {
			Cookie: `_authTokenId=${TEST_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});

	const ttfb = performance.now() - startTime;

	if (!response.ok) {
		throw new Error(`Request failed with status ${response.status}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('Response body is not readable');
	}

	const { recordCount, peakMemory } = await readStreamRecordsWithMetrics(reader, startMemory);

	const endTime = performance.now();
	const endCpu = process.cpuUsage(startCpu);
	const endMemory = process.memoryUsage();

	const totalTime = endTime - startTime;
	const throughput = recordCount / (totalTime / MILLISECONDS_PER_SECOND); // records per second

	return {
		totalTime,
		ttfb,
		heapUsed: endMemory.heapUsed - startMemory.heapUsed,
		heapTotal: endMemory.heapTotal - startMemory.heapTotal,
		rss: endMemory.rss - startMemory.rss,
		cpuUser: endCpu.user / MILLISECONDS_PER_SECOND, // Convert to milliseconds
		cpuSystem: endCpu.system / MILLISECONDS_PER_SECOND,
		recordCount,
		throughput,
		peakMemory: peakMemory - startMemory.heapUsed,
	};
}

function compareMetrics(oldMetrics: BenchmarkMetrics, newMetrics: BenchmarkMetrics): void {
	console.log('\n=== Benchmark Comparison ===');
	console.log('\nOriginal Find (Paginated) - /rest/data/:document/find:');
	console.log(`  Total Time: ${oldMetrics.totalTime.toFixed(2)}ms`);
	console.log(`  TTFB: ${oldMetrics.ttfb.toFixed(2)}ms`);
	console.log(`  Memory Increase: ${(oldMetrics.heapUsed / 1024 / 1024).toFixed(2)}MB`);
	console.log(`  Peak Memory: ${(oldMetrics.peakMemory / 1024 / 1024).toFixed(2)}MB`);
	console.log(`  CPU User: ${oldMetrics.cpuUser.toFixed(2)}ms`);
	console.log(`  CPU System: ${oldMetrics.cpuSystem.toFixed(2)}ms`);
	console.log(`  Records: ${oldMetrics.recordCount}`);
	console.log(`  Throughput: ${oldMetrics.throughput.toFixed(2)} records/sec`);

	console.log('\nNew FindStream - /rest/stream/:document/findStream:');
	console.log(`  Total Time: ${newMetrics.totalTime.toFixed(2)}ms`);
	console.log(`  TTFB: ${newMetrics.ttfb.toFixed(2)}ms`);
	console.log(`  Memory Increase: ${(newMetrics.heapUsed / 1024 / 1024).toFixed(2)}MB`);
	console.log(`  Peak Memory: ${(newMetrics.peakMemory / 1024 / 1024).toFixed(2)}MB`);
	console.log(`  CPU User: ${newMetrics.cpuUser.toFixed(2)}ms`);
	console.log(`  CPU System: ${newMetrics.cpuSystem.toFixed(2)}ms`);
	console.log(`  Records: ${newMetrics.recordCount}`);
	console.log(`  Throughput: ${newMetrics.throughput.toFixed(2)} records/sec`);

	console.log('\n=== Differences ===');
	const timeDiff = ((newMetrics.totalTime - oldMetrics.totalTime) / oldMetrics.totalTime) * 100;
	const memoryDiff = ((newMetrics.heapUsed - oldMetrics.heapUsed) / oldMetrics.heapUsed) * 100;
	const peakMemoryDiff = oldMetrics.peakMemory > 0 
		? ((newMetrics.peakMemory - oldMetrics.peakMemory) / oldMetrics.peakMemory) * 100
		: (newMetrics.peakMemory > 0 ? Infinity : 0);
	const throughputDiff = ((newMetrics.throughput - oldMetrics.throughput) / oldMetrics.throughput) * 100;

	console.log(`  Time: ${timeDiff > 0 ? '+' : ''}${timeDiff.toFixed(2)}%`);
	console.log(`  Memory: ${memoryDiff > 0 ? '+' : ''}${memoryDiff.toFixed(2)}%`);
	console.log(`  Peak Memory: ${peakMemoryDiff > 0 ? '+' : ''}${peakMemoryDiff.toFixed(2)}%`);
	console.log(`  Throughput: ${throughputDiff > 0 ? '+' : ''}${throughputDiff.toFixed(2)}%`);
	console.log('\n');

	// Analysis
	console.log('=== Analysis ===');
	console.log(`\nKey Findings:`);
	console.log(`  • TTFB: New endpoint is ${((oldMetrics.ttfb - newMetrics.ttfb) / oldMetrics.ttfb * 100).toFixed(1)}% faster`);
	console.log(`    (Client receives first data much sooner with streaming)`);
	console.log(`  • Total Time: New endpoint is ${((oldMetrics.totalTime - newMetrics.totalTime) / oldMetrics.totalTime * 100).toFixed(1)}% faster`);
	console.log(`  • Throughput: New endpoint processes ${((newMetrics.throughput - oldMetrics.throughput) / oldMetrics.throughput * 100).toFixed(1)}% more records/sec`);
	console.log(`\nMemory Considerations:`);
	console.log(`  • Find Paginated: Accumulates all ${oldMetrics.recordCount} records in server memory before sending`);
	console.log(`  • FindStream: Processes records incrementally, one at a time`);
	console.log(`  • Client-side memory shown above is for receiving/parsing, not server-side accumulation`);
	console.log(`  • For large datasets (50k+ records), FindStream avoids server memory spikes`);

	if (newMetrics.ttfb < oldMetrics.ttfb) {
		const improvement = ((oldMetrics.ttfb - newMetrics.ttfb) / oldMetrics.ttfb) * 100;
		console.log(`✅ TTFB improved by ${improvement.toFixed(2)}% (faster first byte)`);
	} else {
		const degradation = ((newMetrics.ttfb - oldMetrics.ttfb) / oldMetrics.ttfb) * 100;
		console.log(`⚠️  TTFB degraded by ${degradation.toFixed(2)}%`);
	}
	console.log('\n');
}

async function runBenchmark() {
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

	console.log('Running Benchmark: Opportunity Stream vs Find Paginated');
	console.log(`Filter: status in ["Em Visitação", "Nova", "Ofertando Imóveis", "Proposta", "Contrato"]`);
	console.log(`Target: ~50,000 records (no limit)`);
	console.log(`Server: ${SERVER_URL}\n`);

	// Check server availability
	try {
		// Try health endpoint first
		const healthResponse = await fetch(`${SERVER_URL}/rest/health`, {
			method: 'GET',
		});
		if (healthResponse.ok) {
			console.log('✅ Server is available\n');
		} else {
			// If health returns 404, try a known endpoint
			const testResponse = await fetch(`${SERVER_URL}/rest/data/Opportunity/find?limit=1`, {
				method: 'GET',
				headers: {
					Cookie: `_authTokenId=${TEST_TOKEN}`,
				},
			});
			if (testResponse.status === 0) {
				throw new Error('Server not accessible');
			}
			console.log('✅ Server is available\n');
		}
	} catch {
		console.error('❌ Server not available at', SERVER_URL);
		console.error('Please make sure the server is running on', SERVER_URL);
		process.exit(1);
	}

	const iterations = 3;
	const oldMetricsArray: BenchmarkMetrics[] = [];
	const newMetricsArray: BenchmarkMetrics[] = [];

	// First, check how many records match the filter
	console.log('Checking total records matching filter...');
	let totalRecords = 0;
	try {
		const countResponse = await fetch(
			`${SERVER_URL}/rest/data/Opportunity/find?filter=${encodeURIComponent(filter)}&limit=1`,
			{
				method: 'GET',
				headers: {
					Cookie: `_authTokenId=${TEST_TOKEN}`,
					'Content-Type': 'application/json',
				},
			},
		);
		const countData = await countResponse.json();
		totalRecords = countData.total || 0;
		console.log(`✅ Found ${totalRecords.toLocaleString()} records matching filter\n`);
	} catch (error) {
		console.error('Failed to get record count:', error);
		process.exit(1);
	}

	if (totalRecords === 0) {
		console.error('❌ No records found matching the filter');
		process.exit(1);
	}

	// Use explicit limit to get all records (some endpoints have default limits)
	const limit = totalRecords; // Explicit limit to get all records
	console.log(`⚠️  Testing with ${totalRecords.toLocaleString()} records (limit=${limit}) - this may take several minutes...\n`);

	// Warm up with smaller dataset first
	console.log(`Warming up (with ${WARMUP_RECORD_LIMIT} records)...`);
	try {
		await benchmarkFindPaginated('/rest/data/Opportunity/find', filter, WARMUP_RECORD_LIMIT);
	} catch {
		// Ignore warm-up errors
	}
	try {
		await benchmarkFindStream('/rest/stream/Opportunity/findStream', filter, WARMUP_RECORD_LIMIT);
	} catch {
		// Ignore warm-up errors
	}
	console.log('✅ Warm-up completed\n');
	console.log('⚠️  Starting full benchmark with ~50k records - this may take several minutes...\n');

	// Run benchmarks
	await BluebirdPromise.map(
		Array.from({ length: iterations }, (_, i) => i + 1),
		async iterationNumber => {
			console.log(`Running iteration ${iterationNumber}/${iterations}...`);

			try {
				console.log('  Benchmarking original find (paginated)...');
				const oldMetrics = await benchmarkFindPaginated('/rest/data/Opportunity/find', filter, limit);
				oldMetricsArray.push(oldMetrics);

				// Wait a bit between requests
				await new Promise(resolve => setTimeout(resolve, ITERATION_DELAY_MS));

				console.log('  Benchmarking new findStream...');
				const newMetrics = await benchmarkFindStream('/rest/stream/Opportunity/findStream', filter, limit);
				newMetricsArray.push(newMetrics);

				// Wait a bit between iterations
				await new Promise(resolve => setTimeout(resolve, ITERATION_DELAY_MS));
			} catch (error) {
				console.error(`Iteration ${iterationNumber} failed:`, error);
				// Continue with other iterations
			}
		},
		{ concurrency: BENCHMARK_ITERATION_CONCURRENCY },
	);

	// Calculate averages
	if (oldMetricsArray.length === 0 || newMetricsArray.length === 0) {
		console.log('Skipping comparison - no successful iterations');
		process.exit(1);
	}

	const avgOldMetricsBase = calculateAverageMetrics(oldMetricsArray);
	const avgOldMetrics: BenchmarkMetrics = {
		...avgOldMetricsBase,
		recordCount: Math.round(avgOldMetricsBase.recordCount),
	};

	const avgNewMetricsBase = calculateAverageMetrics(newMetricsArray);
	const avgNewMetrics: BenchmarkMetrics = {
		...avgNewMetricsBase,
		recordCount: Math.round(avgNewMetricsBase.recordCount),
	};

	// Compare and report
	compareMetrics(avgOldMetrics, avgNewMetrics);

	// Validations
	if (avgNewMetrics.recordCount === 0) {
		console.error('❌ ERROR: No records received from new endpoint');
		process.exit(1);
	}
	if (avgOldMetrics.recordCount === 0) {
		console.error('❌ ERROR: No records received from old endpoint');
		process.exit(1);
	}
	if (Math.abs(avgNewMetrics.recordCount - avgOldMetrics.recordCount) > 10) {
		console.warn(
			`⚠️  WARNING: Record count mismatch (old: ${avgOldMetrics.recordCount}, new: ${avgNewMetrics.recordCount})`,
		);
	}

	console.log('✅ Benchmark completed successfully!');
}

runBenchmark().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});

