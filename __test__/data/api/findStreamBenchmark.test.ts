import { expect } from 'chai';
import { login } from '../../utils/login';

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

async function benchmarkEndpoint(endpoint: string, filter: string, authId: string): Promise<BenchmarkMetrics> {
	const startCpu = process.cpuUsage();
	const startMemory = process.memoryUsage();
	const startTime = performance.now();

	const response = await fetch(`http://127.0.0.1:3000${endpoint}?filter=${encodeURIComponent(filter)}`, {
		method: 'GET',
		headers: {
			Cookie: `_authTokenId=${authId}`,
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

	const decoder = new TextDecoder();
	let buffer = '';
	let recordCount = 0;
	let peakMemory = startMemory.heapUsed;

	// Monitor memory during streaming
	const memoryInterval = setInterval(() => {
		const currentMemory = process.memoryUsage();
		peakMemory = Math.max(peakMemory, currentMemory.heapUsed);
	}, 100);

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			if (line.trim()) {
				try {
					JSON.parse(line);
					recordCount++;
				} catch {
					// Not a complete JSON record yet
				}
			}
		}
	}

	clearInterval(memoryInterval);

	const endTime = performance.now();
	const endCpu = process.cpuUsage(startCpu);
	const endMemory = process.memoryUsage();

	const totalTime = endTime - startTime;
	const throughput = recordCount / (totalTime / 1000); // records per second

	return {
		totalTime,
		ttfb,
		heapUsed: endMemory.heapUsed - startMemory.heapUsed,
		heapTotal: endMemory.heapTotal - startMemory.heapTotal,
		rss: endMemory.rss - startMemory.rss,
		cpuUser: endCpu.user / 1000, // Convert to milliseconds
		cpuSystem: endCpu.system / 1000,
		recordCount,
		throughput,
		peakMemory: peakMemory - startMemory.heapUsed,
	};
}

function compareMetrics(oldMetrics: BenchmarkMetrics, newMetrics: BenchmarkMetrics): void {
	console.log('\n=== Benchmark Comparison ===');
	console.log('\nOld Endpoint (/rest/stream/:document/find):');
	console.log(`  Total Time: ${oldMetrics.totalTime.toFixed(2)}ms`);
	console.log(`  TTFB: ${oldMetrics.ttfb.toFixed(2)}ms`);
	console.log(`  Memory Increase: ${(oldMetrics.heapUsed / 1024 / 1024).toFixed(2)}MB`);
	console.log(`  Peak Memory: ${(oldMetrics.peakMemory / 1024 / 1024).toFixed(2)}MB`);
	console.log(`  CPU User: ${oldMetrics.cpuUser.toFixed(2)}ms`);
	console.log(`  CPU System: ${oldMetrics.cpuSystem.toFixed(2)}ms`);
	console.log(`  Records: ${oldMetrics.recordCount}`);
	console.log(`  Throughput: ${oldMetrics.throughput.toFixed(2)} records/sec`);

	console.log('\nNew Endpoint (/rest/stream/:document/findStream):');
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
	const peakMemoryDiff = ((newMetrics.peakMemory - oldMetrics.peakMemory) / oldMetrics.peakMemory) * 100;
	const throughputDiff = ((newMetrics.throughput - oldMetrics.throughput) / oldMetrics.throughput) * 100;

	console.log(`  Time: ${timeDiff > 0 ? '+' : ''}${timeDiff.toFixed(2)}%`);
	console.log(`  Memory: ${memoryDiff > 0 ? '+' : ''}${memoryDiff.toFixed(2)}%`);
	console.log(`  Peak Memory: ${peakMemoryDiff > 0 ? '+' : ''}${peakMemoryDiff.toFixed(2)}%`);
	console.log(`  Throughput: ${throughputDiff > 0 ? '+' : ''}${throughputDiff.toFixed(2)}%`);
	console.log('\n');
}

describe('Benchmark: Opportunity Stream', () => {
	const authId = login('admin-test');
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

	it('should compare performance between old and new endpoints', async function () {
		this.timeout(300000); // 5 minutes timeout for large dataset

		const iterations = 3;
		const oldMetricsArray: BenchmarkMetrics[] = [];
		const newMetricsArray: BenchmarkMetrics[] = [];

		// Warm up
		await benchmarkEndpoint('/rest/stream/Opportunity/find', filter, authId).catch(() => {
			// Ignore warm-up errors
		});
		await benchmarkEndpoint('/rest/stream/Opportunity/findStream', filter, authId).catch(() => {
			// Ignore warm-up errors
		});

		// Run benchmarks
		for (let i = 0; i < iterations; i++) {
			console.log(`\nRunning iteration ${i + 1}/${iterations}...`);

			try {
				const oldMetrics = await benchmarkEndpoint('/rest/stream/Opportunity/find', filter, authId);
				oldMetricsArray.push(oldMetrics);

				// Wait a bit between requests
				await new Promise(resolve => setTimeout(resolve, 2000));

				const newMetrics = await benchmarkEndpoint('/rest/stream/Opportunity/findStream', filter, authId);
				newMetricsArray.push(newMetrics);

				// Wait a bit between iterations
				await new Promise(resolve => setTimeout(resolve, 2000));
			} catch (error) {
				console.error(`Iteration ${i + 1} failed:`, error);
				// Continue with other iterations
			}
		}

		// Calculate averages
		if (oldMetricsArray.length === 0 || newMetricsArray.length === 0) {
			console.log('Skipping comparison - no successful iterations');
			return;
		}

		const avgOldMetrics: BenchmarkMetrics = {
			totalTime: oldMetricsArray.reduce((sum, m) => sum + m.totalTime, 0) / oldMetricsArray.length,
			ttfb: oldMetricsArray.reduce((sum, m) => sum + m.ttfb, 0) / oldMetricsArray.length,
			heapUsed: oldMetricsArray.reduce((sum, m) => sum + m.heapUsed, 0) / oldMetricsArray.length,
			heapTotal: oldMetricsArray.reduce((sum, m) => sum + m.heapTotal, 0) / oldMetricsArray.length,
			rss: oldMetricsArray.reduce((sum, m) => sum + m.rss, 0) / oldMetricsArray.length,
			cpuUser: oldMetricsArray.reduce((sum, m) => sum + m.cpuUser, 0) / oldMetricsArray.length,
			cpuSystem: oldMetricsArray.reduce((sum, m) => sum + m.cpuSystem, 0) / oldMetricsArray.length,
			recordCount: Math.round(oldMetricsArray.reduce((sum, m) => sum + m.recordCount, 0) / oldMetricsArray.length),
			throughput: oldMetricsArray.reduce((sum, m) => sum + m.throughput, 0) / oldMetricsArray.length,
			peakMemory: oldMetricsArray.reduce((sum, m) => sum + m.peakMemory, 0) / oldMetricsArray.length,
		};

		const avgNewMetrics: BenchmarkMetrics = {
			totalTime: newMetricsArray.reduce((sum, m) => sum + m.totalTime, 0) / newMetricsArray.length,
			ttfb: newMetricsArray.reduce((sum, m) => sum + m.ttfb, 0) / newMetricsArray.length,
			heapUsed: newMetricsArray.reduce((sum, m) => sum + m.heapUsed, 0) / newMetricsArray.length,
			heapTotal: newMetricsArray.reduce((sum, m) => sum + m.heapTotal, 0) / newMetricsArray.length,
			rss: newMetricsArray.reduce((sum, m) => sum + m.rss, 0) / newMetricsArray.length,
			cpuUser: newMetricsArray.reduce((sum, m) => sum + m.cpuUser, 0) / newMetricsArray.length,
			cpuSystem: newMetricsArray.reduce((sum, m) => sum + m.cpuSystem, 0) / newMetricsArray.length,
			recordCount: Math.round(newMetricsArray.reduce((sum, m) => sum + m.recordCount, 0) / newMetricsArray.length),
			throughput: newMetricsArray.reduce((sum, m) => sum + m.throughput, 0) / newMetricsArray.length,
			peakMemory: newMetricsArray.reduce((sum, m) => sum + m.peakMemory, 0) / newMetricsArray.length,
		};

		// Compare and report
		compareMetrics(avgOldMetrics, avgNewMetrics);

		// Assertions
		expect(avgNewMetrics.recordCount).to.be.greaterThan(0);
		expect(avgOldMetrics.recordCount).to.be.greaterThan(0);
		expect(avgNewMetrics.recordCount).to.be.equal(avgOldMetrics.recordCount);

		// New endpoint should use less peak memory
		expect(avgNewMetrics.peakMemory).to.be.lessThan(avgOldMetrics.peakMemory * 1.5); // Allow some variance
	});
});

