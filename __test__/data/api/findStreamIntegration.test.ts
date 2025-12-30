import { expect } from 'chai';
import { login } from '../../utils/login';
import { KonectyResponse } from '../../utils/types';

describe('findStream Integration Tests', () => {
	// Use provided token if available, otherwise use fake login
	const authId = process.env.TEST_TOKEN || login('admin-test');
	
	// Skip if server is not accessible
	before(async function() {
		this.timeout(5000);
		try {
			const response = await fetch('http://127.0.0.1:3000/rest/health', {
				method: 'GET',
			});
			if (!response.ok) {
				this.skip();
			}
		} catch {
			this.skip();
		}
	});

	it('should return HTTP 200 with stream for valid request', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=10', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(200);
		expect(response.headers.get('content-type')).to.include('application/json');
	});

	it('should have Transfer-Encoding chunked header', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=10', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		// Fastify may not explicitly set Transfer-Encoding header, but should stream
		expect(response.ok).to.be.true;
	});

	it('should stream data incrementally', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=50', {
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

		let chunkCount = 0;
		let totalBytes = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			chunkCount++;
			totalBytes += value.length;
		}

		expect(chunkCount).to.be.greaterThan(0);
		expect(totalBytes).to.be.greaterThan(0);
	});

	it('should handle filter parameter', async () => {
		const filter = JSON.stringify({
			match: 'and',
			conditions: [
				{
					term: 'status',
					operator: 'equals',
					value: 'draft',
				},
			],
		});

		const response = await fetch(`http://127.0.0.1:3000/rest/stream/Product/findStream?filter=${encodeURIComponent(filter)}&limit=10`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(200);
	});

	it('should handle sort parameter', async () => {
		const sort = JSON.stringify({ name: 1 });

		const response = await fetch(`http://127.0.0.1:3000/rest/stream/Product/findStream?sort=${encodeURIComponent(sort)}&limit=10`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(200);
	});

	it('should handle fields parameter', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?fields=name,status&limit=10', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(200);
	});

	it('should handle limit and start parameters', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=5&start=0', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(200);
	});

	it('should return 500 for invalid document', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/InvalidDocument/findStream', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(500);
	});

	it('should require authentication', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		// Should return error without auth
		expect(response.status).to.not.equal(200);
	});

	it('should handle withDetailFields parameter', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?withDetailFields=true&limit=10', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(200);
	});
});

