import { logger } from '@imports/utils/logger';
import { create } from '@imports/data/data';
import { KonFilter } from '@imports/model/Filter';

export interface ExportAuditPayload {
	document: string;
	listName: string;
	type: 'csv' | 'xlsx' | 'json';
	start: number;
	limit: number;
	threshold: number;
	fields?: string;
	filter?: KonFilter;
	sort?: string;
	status: 'success' | 'denied' | 'error';
	reason?: string;
	durationMs: number;
}

/**
 * Log an export operation to AccessLog collection.
 * Sanitizes sensitive information and tracks all export attempts for auditing.
 */
export async function logExportToAccessLog(
	authTokenId: string | undefined,
	payload: ExportAuditPayload,
): Promise<void> {
	try {
		const sanitizedPayload = {
			__from: 'export',
			document: payload.document,
			listName: payload.listName,
			type: payload.type,
			start: payload.start,
			limit: payload.limit,
			threshold: payload.threshold,
			// Truncate large fields
			fields: payload.fields ? (payload.fields.length > 500 ? payload.fields.substring(0, 500) + '...' : payload.fields) : undefined,
			// Sanitize filter (truncate if too large)
			filter: payload.filter ? JSON.stringify(payload.filter).substring(0, 1000) : undefined,
			// Sanitize sort (truncate if too large)
			sort: payload.sort ? payload.sort.substring(0, 500) : undefined,
			status: payload.status,
			reason: payload.reason,
			durationMs: payload.durationMs,
		};

		// Create AccessLog entry - use authTokenId to let backend set _createdBy
		const result = await create({
			authTokenId,
			document: 'AccessLog',
			data: sanitizedPayload,
		} as any);

		if (result.success === false) {
			logger.warn(`Failed to log export to AccessLog: ${JSON.stringify(result.errors)}`);
		}
	} catch (error) {
		logger.error(`Error logging export to AccessLog: ${error instanceof Error ? error.message : String(error)}`);
		// Don't throw - we don't want failed audit logging to break the export
	}
}

/**
 * Sanitize filter and sort for logging.
 * Truncates large values to prevent excessive log entries.
 */
export function sanitizeFilterForLog(filter?: KonFilter): string | undefined {
	if (!filter) return undefined;
	const serialized = JSON.stringify(filter);
	return serialized.length > 1000 ? serialized.substring(0, 1000) + '...' : serialized;
}

/**
 * Sanitize fields list for logging.
 * Truncates large lists to prevent excessive log entries.
 */
export function sanitizeFieldsForLog(fields?: string): string | undefined {
	if (!fields) return undefined;
	return fields.length > 500 ? fields.substring(0, 500) + '...' : fields;
}
