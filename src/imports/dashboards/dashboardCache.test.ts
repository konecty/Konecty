import {
	buildCacheKey,
	hashFilter,
	generateEtag,
} from './dashboardCache';

/**
 * Tests for dashboardCache utility functions.
 * These test the pure functions (no MongoDB dependency).
 *
 * ADR-0012: no-magic-numbers in test constants.
 */

describe('dashboardCache', () => {
	describe('buildCacheKey', () => {
		it('should produce a deterministic hash for the same inputs', () => {
			const key1 = buildCacheKey('user-1', 'Contact', 'count', null, undefined);
			const key2 = buildCacheKey('user-1', 'Contact', 'count', null, undefined);
			expect(key1).toBe(key2);
		});

		it('should produce different hashes for different users', () => {
			const key1 = buildCacheKey('user-1', 'Contact', 'count', null, undefined);
			const key2 = buildCacheKey('user-2', 'Contact', 'count', null, undefined);
			expect(key1).not.toBe(key2);
		});

		it('should produce different hashes for different documents', () => {
			const key1 = buildCacheKey('user-1', 'Contact', 'count', null, undefined);
			const key2 = buildCacheKey('user-1', 'Company', 'count', null, undefined);
			expect(key1).not.toBe(key2);
		});

		it('should produce different hashes for different operations', () => {
			const key1 = buildCacheKey('user-1', 'Contact', 'count', null, undefined);
			const key2 = buildCacheKey('user-1', 'Contact', 'sum', 'amount', undefined);
			expect(key1).not.toBe(key2);
		});

		it('should produce different hashes for different filters', () => {
			const filter1 = { status: { $eq: 'active' } };
			const filter2 = { status: { $eq: 'inactive' } };
			const key1 = buildCacheKey('user-1', 'Contact', 'count', null, filter1);
			const key2 = buildCacheKey('user-1', 'Contact', 'count', null, filter2);
			expect(key1).not.toBe(key2);
		});

		it('should produce a hex string', () => {
			const key = buildCacheKey('user-1', 'Contact', 'count', null, undefined);
			expect(key).toMatch(/^[a-f0-9]+$/);
		});
	});

	describe('hashFilter', () => {
		it('should produce same hash for same filter', () => {
			const filter = { status: 'active' };
			const hash1 = hashFilter(filter);
			const hash2 = hashFilter(filter);
			expect(hash1).toBe(hash2);
		});

		it('should handle null filter', () => {
			const hash1 = hashFilter(null);
			const hash2 = hashFilter(undefined);
			expect(hash1).toBe(hash2);
		});

		it('should produce different hashes for different filters', () => {
			const hash1 = hashFilter({ a: 1 });
			const hash2 = hashFilter({ b: 2 });
			expect(hash1).not.toBe(hash2);
		});
	});

	describe('generateEtag', () => {
		const VALUE_A = 42;
		const VALUE_B = 100;
		const COUNT_A = 10;
		const COUNT_B = 20;

		it('should produce a quoted string', () => {
			const etag = generateEtag(VALUE_A, COUNT_A);
			expect(etag).toMatch(/^"[a-f0-9]+"$/);
		});

		it('should produce same etag for same inputs', () => {
			const etag1 = generateEtag(VALUE_A, COUNT_A);
			const etag2 = generateEtag(VALUE_A, COUNT_A);
			expect(etag1).toBe(etag2);
		});

		it('should produce different etags for different values', () => {
			const etag1 = generateEtag(VALUE_A, COUNT_A);
			const etag2 = generateEtag(VALUE_B, COUNT_A);
			expect(etag1).not.toBe(etag2);
		});

		it('should produce different etags for different counts', () => {
			const etag1 = generateEtag(VALUE_A, COUNT_A);
			const etag2 = generateEtag(VALUE_A, COUNT_B);
			expect(etag1).not.toBe(etag2);
		});
	});
});
