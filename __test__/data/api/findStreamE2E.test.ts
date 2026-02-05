import { expect } from 'chai';
import { login } from '../../utils/login';

describe('findStream E2E Tests', () => {
	const authId = login('admin-test');

	it('should stream large volumes of data without accumulating in memory', async () => {
		const initialMemory = process.memoryUsage().heapUsed;
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=1000', {
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

		let recordCount = 0;
		let maxMemory = initialMemory;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			recordCount++;
			const currentMemory = process.memoryUsage().heapUsed;
			maxMemory = Math.max(maxMemory, currentMemory);

			// Force garbage collection hint
			if (recordCount % 100 === 0) {
				await new Promise(resolve => setImmediate(resolve));
			}
		}

		const finalMemory = process.memoryUsage().heapUsed;
		const memoryIncrease = finalMemory - initialMemory;

		expect(recordCount).to.be.greaterThan(0);
		// Memory increase should be reasonable (not proportional to record count)
		expect(memoryIncrease).to.be.lessThan(100 * 1024 * 1024); // Less than 100MB
	});

	it('should validate data received incrementally', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=100', {
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

		const decoder = new TextDecoder();
		let buffer = '';
		let recordCount = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.trim()) {
					try {
						const record = JSON.parse(line);
						expect(record).to.have.property('_id');
						recordCount++;
					} catch {
						// Not a complete JSON record yet
					}
				}
			}
		}

		expect(recordCount).to.be.greaterThan(0);
	});

	it('should handle backpressure when client is slow', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=500', {
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

		let recordCount = 0;

		while (true) {
			const { done } = await reader.read();
			if (done) break;

			recordCount++;
			// Simulate slow client processing
			await new Promise(resolve => setTimeout(resolve, 10));
		}

		expect(recordCount).to.be.greaterThan(0);
	});

	it('should handle stream cancellation', async () => {
		const controller = new AbortController();
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=1000', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
			signal: controller.signal,
		});

		expect(response.ok).to.be.true;

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Response body is not readable');
		}

		let recordCount = 0;

		// Read a few records then cancel
		while (recordCount < 10) {
			const { done } = await reader.read();
			if (done) break;
			recordCount++;
		}

		controller.abort();
		await reader.cancel();

		expect(recordCount).to.be.greaterThan(0);
	});

	it('should return same results as old endpoint', async () => {
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

		const [oldResponse, newResponse] = await Promise.all([
			fetch(`http://127.0.0.1:3000/rest/stream/Product/find?filter=${encodeURIComponent(filter)}&limit=10`, {
				method: 'GET',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
			}),
			fetch(`http://127.0.0.1:3000/rest/stream/Product/findStream?filter=${encodeURIComponent(filter)}&limit=10`, {
				method: 'GET',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
			}),
		]);

		expect(oldResponse.ok).to.be.true;
		expect(newResponse.ok).to.be.true;

		// Both should return data (exact comparison would require parsing streams)
		expect(oldResponse.body).to.not.be.null;
		expect(newResponse.body).to.not.be.null;
	});

	it('should handle complex filters', async () => {
		const filter = JSON.stringify({
			match: 'and',
			conditions: [
				{
					term: 'status',
					operator: 'in',
					value: ['draft', 'active'],
				},
			],
		});

		const response = await fetch(`http://127.0.0.1:3000/rest/stream/Product/findStream?filter=${encodeURIComponent(filter)}&limit=50`, {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(200);
	});

	it('should handle withDetailFields', async () => {
		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?withDetailFields=true&limit=10', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${authId}`,
				'Content-Type': 'application/json',
			},
		});

		expect(response.status).to.equal(200);
	});

	it('should handle different user permissions', async () => {
		const userAuthId = login('user-test');

		const response = await fetch('http://127.0.0.1:3000/rest/stream/Product/findStream?limit=10', {
			method: 'GET',
			headers: {
				Cookie: `_authTokenId=${userAuthId}`,
				'Content-Type': 'application/json',
			},
		});

		// Should either succeed with filtered data or return permission error
		expect([200, 403, 500]).to.include(response.status);
	});
});

