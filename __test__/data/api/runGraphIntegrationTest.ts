// Direct integration test runner for graph endpoint that bypasses Jest globalSetup
import { expect } from 'chai';
import { GraphConfig } from '@imports/types/graph';

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'CupITXzG8fdfqGgwtV5j4PC5aFXrk8lz/2eW7JhwqvA=';

async function fetchGraph(document: string, graphConfig: GraphConfig, filter?: any, limit?: number): Promise<{ status: number; contentType: string; svg: string }> {
	const queryParams = new URLSearchParams();
	queryParams.append('graphConfig', JSON.stringify(graphConfig));
	if (filter) {
		queryParams.append('filter', JSON.stringify(filter));
	}
	if (limit) {
		queryParams.append('limit', String(limit));
	}

	const response = await fetch(`${SERVER_URL}/rest/data/${document}/graph?${queryParams.toString()}`, {
		method: 'GET',
		headers: {
			Cookie: `_authTokenId=${TEST_TOKEN}`,
		},
	});

	const svg = await response.text();
	return { status: response.status, contentType: response.headers.get('content-type') || '', svg };
}

async function checkServerAvailable(): Promise<boolean> {
	try {
		const healthResponse = await fetch(`${SERVER_URL}/rest/health`, {
			method: 'GET',
		});
		if (healthResponse.ok) {
			return true;
		}
		const testResponse = await fetch(`${SERVER_URL}/rest/data/Product?limit=1`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${TEST_TOKEN}`,
			},
		});
		return testResponse.status !== 0;
	} catch {
		return false;
	}
}

async function runTests() {
	console.log('Running graph integration tests against', SERVER_URL, '\n');

	const serverAvailable = await checkServerAvailable();
	if (!serverAvailable) {
		console.error('❌ Server not available at', SERVER_URL);
		console.error('Please make sure the server is running on', SERVER_URL);
		process.exit(1);
	}

	console.log('✅ Server is available\n');

	const testResults = { passed: 0, failed: 0 };

	// Test 1: Bar chart with aggregation (count by status)
	try {
		console.log('Test 1: should generate bar chart with count aggregation by status');
		const filter = { status: { $in: ['Nova', 'Em Visitação', 'Contrato', 'Ofertando Imóveis', 'Proposta'] } };
		const graphConfig: GraphConfig = {
			type: 'bar',
			categoryField: 'status',
			aggregation: 'count',
			xAxis: { field: 'status', label: 'Status' },
			yAxis: { field: 'code', label: 'Quantidade' },
			title: 'Oportunidades por Status',
		};
		const { status, contentType, svg } = await fetchGraph('Opportunity', graphConfig, filter, 1000);
		if (status !== 200) {
			console.error(`   Error response (${status}):`, svg.substring(0, 500));
		}
		expect(status).to.equal(200);
		expect(contentType).to.include('image/svg+xml');
		expect(svg).to.be.a('string');
		expect(svg.length).to.be.greaterThan(0);
		expect(svg).to.include('<svg');
		console.log(`   SVG length: ${svg.length} bytes`);
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 2: Bar chart with sum aggregation (values by status)
	try {
		console.log('Test 2: should generate bar chart with sum aggregation by status');
		const filter = { status: { $in: ['Nova', 'Em Visitação', 'Contrato', 'Ofertando Imóveis', 'Proposta'] } };
		const graphConfig: GraphConfig = {
			type: 'bar',
			categoryField: 'status',
			aggregation: 'sum',
			xAxis: { field: 'status', label: 'Status' },
			yAxis: { field: 'amount.value', label: 'Valor Total' },
			title: 'Valor Total por Status',
		};
		const { status, contentType, svg } = await fetchGraph('Opportunity', graphConfig, filter, 1000);
		expect(status).to.equal(200);
		expect(contentType).to.include('image/svg+xml');
		expect(svg).to.be.a('string');
		expect(svg.length).to.be.greaterThan(0);
		expect(svg).to.include('<svg');
		console.log(`   SVG length: ${svg.length} bytes`);
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 3: Bar chart by director
	try {
		console.log('Test 3: should generate bar chart by director');
		const filter = { status: { $in: ['Nova', 'Em Visitação', 'Contrato', 'Ofertando Imóveis', 'Proposta'] } };
		const graphConfig: GraphConfig = {
			type: 'bar',
			categoryField: '_user.director.nickname',
			aggregation: 'count',
			xAxis: { field: '_user.director.nickname', label: 'Diretor' },
			yAxis: { field: 'code', label: 'Quantidade' },
			title: 'Oportunidades por Diretor',
		};
		const { status, contentType, svg } = await fetchGraph('Opportunity', graphConfig, filter, 1000);
		expect(status).to.equal(200);
		expect(contentType).to.include('image/svg+xml');
		expect(svg).to.be.a('string');
		expect(svg.length).to.be.greaterThan(0);
		expect(svg).to.include('<svg');
		console.log(`   SVG length: ${svg.length} bytes`);
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 4: Pie chart
	try {
		console.log('Test 4: should generate pie chart');
		const filter = { status: { $in: ['Nova', 'Em Visitação', 'Contrato', 'Ofertando Imóveis', 'Proposta'] } };
		const graphConfig: GraphConfig = {
			type: 'pie',
			categoryField: 'status',
			aggregation: 'count',
			yAxis: { field: 'code' }, // Pie chart needs yAxis for aggregation
			title: 'Distribuição por Status',
		};
		const { status, contentType, svg } = await fetchGraph('Opportunity', graphConfig, filter, 1000);
		if (status !== 200) {
			console.error(`   Error response (${status}):`, svg.substring(0, 500));
		}
		expect(status).to.equal(200);
		expect(contentType).to.include('image/svg+xml');
		expect(svg).to.be.a('string');
		expect(svg.length).to.be.greaterThan(0);
		expect(svg).to.include('<svg');
		console.log(`   SVG length: ${svg.length} bytes`);
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 5: Error - missing graphConfig
	try {
		console.log('Test 5: should return error when graphConfig is missing');
		const response = await fetch(`${SERVER_URL}/rest/data/Opportunity/graph`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${TEST_TOKEN}`,
			},
		});
		const data = await response.json();
		expect(data.success).to.be.false;
		expect(data.errors?.[0]?.message).to.include('graphConfig is required');
		console.log('✅ PASSED\n');
		testResults.passed++;
	} catch (error) {
		console.error('❌ FAILED:', error);
		testResults.failed++;
	}

	// Test 6: Error - invalid graphConfig (missing type)
	try {
		console.log('Test 6: should return error when graphConfig.type is missing');
		// Send request without type in graphConfig
		const queryParams = new URLSearchParams();
		queryParams.append('graphConfig', JSON.stringify({}));
		const response = await fetch(`${SERVER_URL}/rest/data/Opportunity/graph?${queryParams.toString()}`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${TEST_TOKEN}`,
			},
		});
		const data = await response.json();
		expect(data.success).to.be.false;
		expect(data.errors?.[0]?.message).to.include('graphConfig.type is required');
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

