import { createHash } from 'node:crypto';
import type { Collection } from 'mongodb';

import { db } from '@imports/database';
import { logger } from '@imports/utils/logger';

// ADR-0012: no-magic-numbers — all numeric defaults as named constants
const COLLECTION_NAME = 'dashboardCache';
const DEFAULT_CACHE_TTL_SECONDS = 300; // 5 minutes
const MILLISECONDS_PER_SECOND = 1_000;
const HASH_ALGORITHM = 'sha256';
const HASH_ENCODING = 'hex' as const;
const ETAG_HASH_LENGTH = 16; // first 16 chars of hex hash for ETag brevity

// --- Cache Entry Type ---

export interface CacheEntry {
	_id: string; // deterministic hash of cache key
	userId: string; // user-scoped to prevent data leakage
	document: string; // Konecty document name
	operation: string; // count, sum, avg, min, max, percentage, graph, pivot
	field: string | null;
	filterHash: string; // SHA-256 of JSON.stringify(filter)
	value: number;
	count: number;
	blob?: string; // ADR-0049: SVG or serialized JSON for chart/table widgets
	etag: string; // hash of value for HTTP 304
	expiresAt: Date; // MongoDB TTL auto-deletes
	createdAt: Date;
}

/** Subset of CacheEntry returned by blob cache operations (chart/table widgets) */
export interface BlobCacheEntry {
	blob: string;
	etag: string;
}

// --- Collection accessor ---

const getCollection = (): Collection<CacheEntry> => db.collection(COLLECTION_NAME);

// --- Index management ---

/**
 * Creates required indexes for the dashboardCache collection:
 * 1. TTL index on expiresAt for automatic document expiration
 * 2. Compound index on cache key fields for fast lookups
 */
export const ensureCacheIndexes = async (): Promise<void> => {
	const collection = getCollection();

	try {
		// TTL index: MongoDB automatically removes documents when expiresAt is reached
		await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

		// Compound index for cache key lookups
		await collection.createIndex(
			{ userId: 1, document: 1, operation: 1, field: 1, filterHash: 1 },
			{ unique: true },
		);

		// Index for invalidation by document (bulk delete)
		await collection.createIndex({ document: 1 });

		logger.info('Dashboard cache indexes ensured');
	} catch (error) {
		logger.error(error, 'Failed to ensure dashboard cache indexes');
	}
};

// --- Cache key building ---

/**
 * Builds a deterministic cache key string from the query parameters.
 * Used as the _id of the cache document.
 */
export const buildCacheKey = (
	userId: string,
	document: string,
	operation: string,
	field: string | null,
	filter: unknown,
): string => {
	const filterStr = filter != null ? JSON.stringify(filter) : '';
	const raw = `${userId}:${document}:${operation}:${field ?? ''}:${filterStr}`;
	return createHash(HASH_ALGORITHM).update(raw).digest(HASH_ENCODING);
};

/**
 * Creates a SHA-256 hash of the filter object for storage.
 */
export const hashFilter = (filter: unknown): string => {
	const str = filter != null ? JSON.stringify(filter) : '';
	return createHash(HASH_ALGORITHM).update(str).digest(HASH_ENCODING);
};

// --- ETag generation ---

/**
 * Generates an ETag string from the cached value and count.
 * Uses a truncated SHA-256 hash for brevity.
 */
export const generateEtag = (value: number, count: number): string => {
	const raw = `${value}:${count}`;
	const hash = createHash(HASH_ALGORITHM).update(raw).digest(HASH_ENCODING);
	return `"${hash.substring(0, ETAG_HASH_LENGTH)}"`;
};

// --- Cache operations ---

/**
 * Retrieves a cached entry by key. Returns null if not found or expired.
 * MongoDB TTL handles expiration, but we also check expiresAt defensively.
 */
export const getCached = async (cacheKey: string): Promise<CacheEntry | null> => {
	const collection = getCollection();

	try {
		const entry = await collection.findOne({ _id: cacheKey });

		if (entry == null) {
			return null;
		}

		// Defensive check: TTL cleanup may lag
		if (entry.expiresAt < new Date()) {
			return null;
		}

		return entry;
	} catch (error) {
		logger.error(error, 'Error reading dashboard cache');
		return null;
	}
};

/**
 * Stores or updates a cache entry with the given TTL.
 * Uses upsert to handle both insert and update cases atomically.
 */
export const setCached = async (
	userId: string,
	document: string,
	operation: string,
	field: string | null,
	filter: unknown,
	value: number,
	count: number,
	ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS,
): Promise<CacheEntry> => {
	const collection = getCollection();
	const cacheKey = buildCacheKey(userId, document, operation, field, filter);
	const now = new Date();
	const expiresAt = new Date(now.getTime() + ttlSeconds * MILLISECONDS_PER_SECOND);
	const etag = generateEtag(value, count);
	const filterH = hashFilter(filter);

	const entry: CacheEntry = {
		_id: cacheKey,
		userId,
		document,
		operation,
		field,
		filterHash: filterH,
		value,
		count,
		etag,
		expiresAt,
		createdAt: now,
	};

	try {
		await collection.replaceOne({ _id: cacheKey }, entry, { upsert: true });
		logger.trace({ cacheKey, document, operation, ttlSeconds }, 'Dashboard cache entry stored');
	} catch (error) {
		logger.error(error, 'Error writing dashboard cache');
	}

	return entry;
};

// --- Blob cache operations (ADR-0049: chart SVG, pivot JSON) ---

/**
 * Generates an ETag string from a blob (SVG or JSON string).
 * Uses the same truncated SHA-256 pattern as generateEtag.
 */
export const generateBlobEtag = (data: string): string => {
	const hash = createHash(HASH_ALGORITHM).update(data).digest(HASH_ENCODING);
	return `"${hash.substring(0, ETAG_HASH_LENGTH)}"`;
};

/**
 * Retrieves a cached blob entry by key. Returns null if not found or expired.
 * Used for chart SVG and pivot JSON cache (ADR-0049).
 */
export const getCachedBlob = async (cacheKey: string): Promise<BlobCacheEntry | null> => {
	const collection = getCollection();

	try {
		const entry = await collection.findOne({ _id: cacheKey });

		if (entry == null || entry.blob == null) {
			return null;
		}

		// Defensive check: TTL cleanup may lag
		if (entry.expiresAt < new Date()) {
			return null;
		}

		return { blob: entry.blob, etag: entry.etag };
	} catch (error) {
		logger.error(error, 'Error reading dashboard blob cache');
		return null;
	}
};

/**
 * Stores or updates a blob cache entry with the given TTL.
 * Uses upsert to handle both insert and update cases atomically.
 * Reuses buildCacheKey, hashFilter, and existing indexes (Open/Closed principle).
 */
export const setCachedBlob = async (
	userId: string,
	document: string,
	operation: string,
	field: string | null,
	filter: unknown,
	blob: string,
	ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS,
): Promise<BlobCacheEntry> => {
	const collection = getCollection();
	const cacheKey = buildCacheKey(userId, document, operation, field, filter);
	const now = new Date();
	const expiresAt = new Date(now.getTime() + ttlSeconds * MILLISECONDS_PER_SECOND);
	const etag = generateBlobEtag(blob);
	const filterH = hashFilter(filter);

	const entry: CacheEntry = {
		_id: cacheKey,
		userId,
		document,
		operation,
		field,
		filterHash: filterH,
		value: 0,
		count: 0,
		blob,
		etag,
		expiresAt,
		createdAt: now,
	};

	try {
		await collection.replaceOne({ _id: cacheKey }, entry, { upsert: true });
		logger.trace({ cacheKey, document, operation, ttlSeconds }, 'Dashboard blob cache entry stored');
	} catch (error) {
		logger.error(error, 'Error writing dashboard blob cache');
	}

	return { blob, etag };
};

/**
 * Invalidates all cache entries for a given Konecty document.
 * Useful when data in that document changes.
 */
export const invalidateByDocument = async (document: string): Promise<number> => {
	const collection = getCollection();

	try {
		const result = await collection.deleteMany({ document });
		const deletedCount = result.deletedCount ?? 0;
		logger.info({ document, deletedCount }, 'Dashboard cache invalidated for document');
		return deletedCount;
	} catch (error) {
		logger.error(error, 'Error invalidating dashboard cache');
		return 0;
	}
};

/**
 * Invalidates a specific cache entry by key.
 */
export const invalidateByKey = async (cacheKey: string): Promise<boolean> => {
	const collection = getCollection();

	try {
		const result = await collection.deleteOne({ _id: cacheKey });
		return (result.deletedCount ?? 0) > 0;
	} catch (error) {
		logger.error(error, 'Error invalidating dashboard cache entry');
		return false;
	}
};
