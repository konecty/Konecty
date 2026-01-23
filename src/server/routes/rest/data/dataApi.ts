import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

import { find, pivotStream, graphStream } from '@imports/data/api';
import { create, deleteData, findById, findByLookup, getNextUserFromQueue, historyFind, relationCreate, saveLead, update } from '@imports/data/data';
import { PivotConfig } from '@imports/types/pivot';
import { GraphConfig } from '@imports/types/graph';

import { getUserSafe } from '@imports/auth/getUser';
import { getAccessFor } from '@imports/utils/accessUtils';
import { errorReturn } from '@imports/utils/return';
import { KonFilter } from '@imports/model/Filter';
import { getGraphErrorMessage } from '@imports/utils/graphErrors';
import { MetaObject } from '@imports/model/MetaObject';
import type { KonectyError } from '@imports/types/result';

import exportData from '@imports/data/export';

export const dataApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.post<{ Body: { lead: unknown; save: unknown } }>('/rest/data/lead/save', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const lead = req.body.lead;
		const save = req.body.save;
		const result = await saveLead({
			authTokenId,
			lead,
			save,
		} as any);
		reply.send(result);
	});

	fastify.get<{
		Params: { document: string };
		Querystring: { displayName: string; displayType: string; fields: string; filter: string; sort: string; limit: string; start: string; withDetailFields: string };
	}>('/rest/data/:document/find', async (req, reply) => {
		if (req.query.filter != null && isString(req.query.filter)) {
			req.query.filter = JSON.parse(req.query.filter.replace(/\+/g, ' '));
		}

		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET find');

		const result = await find({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: req.query.filter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			getTotal: true,
			tracingSpan,
		} as any);

		tracingSpan.end();
		reply.send(result);
	});

	fastify.post<{
		Params: { document: string };
		Querystring: {
			displayName: string;
			displayType: string;
			fields: string;
			filter: unknown;
			sort: unknown;
			limit: number;
			start: number;
			withDetailFields: boolean;
		};
		Body: unknown;
	}>('/rest/data/:document/find', async (req, reply) => {
		if (isObject(req.body)) {
			req.query.filter = req.body;
		}

		const result = await find({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: req.query.filter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			getTotal: true,
		} as any);
		reply.send(result);
	});

	fastify.get<{ Params: { document: string; queueId: string } }>('/rest/data/:document/queue/next/:queueId', async (req, reply) => {
		const result = await getNextUserFromQueue({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			queueId: req.params.queueId,
		} as any);

		reply.send(result);
	});

	fastify.get<{ Params: { document: string; dataId: string }; Querystring: { fields?: string; withDetailFields: string } }>(
		'/rest/data/:document/:dataId',
		async (req, reply) => {
			const result = await findById({
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				fields: req.query.fields,
				dataId: req.params.dataId,
				withDetailFields: req.query.withDetailFields,
			});

			reply.send(result);
		},
	);

	fastify.get<{ Params: { document: string; field: string }; Querystring: { search: string; filter: string; start: string; limit: string; useChangeUserFilter: string } }>(
		'/rest/data/:document/lookup/:field',
		async (req, reply) => {
			const extraFilter = isString(req.query.filter) ? JSON.parse(req.query.filter) : undefined;

			const result = await findByLookup({
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				field: req.params.field,
				search: req.query.search,
				extraFilter,
				start: req.query.start,
				limit: req.query.limit,
				useChangeUserFilter: req.query.useChangeUserFilter === 'true',
			});

			reply.send(result);
		},
	);

	fastify.post<{ Params: { document: string }; Body: unknown }>('/rest/data/:document', async (req, reply) => {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('POST create');

		const result = await create({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
			tracingSpan,
		} as any);

		tracingSpan.end();
		reply.send(result);
	});

	fastify.put<{ Params: { document: string }; Body: unknown }>('/rest/data/:document', async (req, reply) => {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('PUT update');

		const result = await update({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
			tracingSpan,
		} as any);

		tracingSpan.end();
		reply.send(result);
	});

	fastify.delete<{ Params: { document: string }; Body: unknown }>('/rest/data/:document', async (req, reply) => {
		const result = await deleteData({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
		} as any);

		reply.send(result);
	});

	fastify.post<{ Params: { document: string; fieldName: string }; Body: unknown }>('/rest/data/:document/relations/:fieldName', async (req, reply) => {
		const result = await relationCreate({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			fieldName: req.params.fieldName,
			data: req.body,
		} as any);

		reply.send(result);
	});

	fastify.post<{ Params: { document: string; fieldName: string }; Body: unknown }>('/rest/data/:document/relations/:fieldName/preview', async (req, reply) => {
		const result = await relationCreate({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			fieldName: req.params.fieldName,
			data: req.body,
			preview: true,
		} as any);

		reply.send(result);
	});

	fastify.get<{ Params: { document: string; dataId: string }; Querystring: { fields: string } }>('/rest/data/:document/:dataId/history', async (req, reply) => {
		const result = await historyFind({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
			fields: req.query.fields,
		} as any);

		reply.send(result);
	});

	fastify.get<{
		Params: { document: string; listName: string; type: 'csv' | 'xls' | 'xlsx' | 'json' };
		Querystring: {
			filter: string | object;
			sort?: string;
			fields?: string;
			displayName?: string;
			displayType?: string;
			limit?: number;
			start?: number;
		};
	}>('/rest/data/:document/list/:listName/:type', async (req, reply) => {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET export');
		const exportStartTime = Date.now();

		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		tracingSpan.setAttribute('authTokenId', authTokenId ?? 'undefined');

		if (userResult.success === false) {
			return userResult;
		}

		const user = userResult.data;
		const { document, listName, type } = req.params;
		
		tracingSpan.setAttributes({ document, listName, type });

		// Get export threshold from namespace config (default: 1000)
		const DEFAULT_EXPORT_LARGE_THRESHOLD = 1000;
		const threshold = MetaObject.Namespace?.export?.largeThreshold ?? DEFAULT_EXPORT_LARGE_THRESHOLD;

		const access = getAccessFor(document, user);
		if (access === false || access.isReadable !== true) {
			const durationMs = Date.now() - exportStartTime;
			tracingSpan.end();
			
			// Log denied access
			const { logExportToAccessLog } = await import('@imports/audit/accessLogExport');
			await logExportToAccessLog(authTokenId, {
				document,
				listName,
				type: (type === 'xls' ? 'xlsx' : type) as 'csv' | 'xlsx' | 'json',
				start: req.query.start ?? 0,
				limit: req.query.limit ?? 0,
				threshold: DEFAULT_EXPORT_LARGE_THRESHOLD,
				status: 'denied',
				reason: 'No read permission on document',
				durationMs,
			});
			
			const errorResult = errorReturn([
				{
					code: 'export.error.readPermission.denied',
					message: "You don't have permission to view this data",
					details: JSON.stringify({ document }),
				},
			]);
			return reply.status(403).type('application/json').send(errorResult);
		}

		// Validate export type and normalize xls -> xlsx
		const normalizedType = type === 'xls' ? 'xlsx' : type;
		if (!['csv', 'xlsx', 'json'].includes(normalizedType)) {
			const durationMs = Date.now() - exportStartTime;
			tracingSpan.end();
			
			// Log invalid type
			const { logExportToAccessLog } = await import('@imports/audit/accessLogExport');
			await logExportToAccessLog(authTokenId, {
				document,
				listName,
				type: normalizedType as 'csv' | 'xlsx' | 'json',
				start: req.query.start ?? 0,
				limit: req.query.limit ?? 0,
				threshold: DEFAULT_EXPORT_LARGE_THRESHOLD,
				status: 'error',
				reason: `Invalid export type: ${normalizedType}`,
				durationMs,
			});
			
			const errorResult = errorReturn([
				{
					code: 'export.error.invalidType',
					message: 'Export format not supported. Use CSV, Excel, or JSON',
					details: JSON.stringify({ document, type: normalizedType, supported: ['csv', 'xlsx', 'json'] }),
				},
			]);
			return reply.status(400).type('application/json').send(errorResult);
		}

		// Check export permissions
		// Admin users bypass permission checks
		const isAdmin = user.admin === true;
		if (!isAdmin) {
			// For xlsx, also check xls (legacy format) in metadata
			const exportPermissions = normalizedType === 'xlsx' && !access?.export?.[normalizedType]
				? access?.export?.xls
				: access?.export?.[normalizedType];
			
			if (!exportPermissions || !exportPermissions.includes('list')) {
				const durationMs = Date.now() - exportStartTime;
				tracingSpan.end();
				
				// Log denied export permission
				const { logExportToAccessLog } = await import('@imports/audit/accessLogExport');
				await logExportToAccessLog(authTokenId, {
					document,
					listName,
					type: normalizedType as 'csv' | 'xlsx' | 'json',
					start: req.query.start ?? 0,
					limit: req.query.limit ?? 0,
				threshold: DEFAULT_EXPORT_LARGE_THRESHOLD,
				status: 'denied',
				reason: `No export permission for type: ${normalizedType}`,
					durationMs,
				});
				
				const errorResult = errorReturn([
					{
						code: 'export.error.permission.denied',
						message: "You don't have permission to export in this format",
						details: JSON.stringify({ document, type: normalizedType }),
					},
				]);
				return reply.status(403).type('application/json').send(errorResult);
			}
		}

		const requestLimit = req.query.limit ? Number(req.query.limit) : threshold;

		// Check if export is "large" and validate exportLarge permission
		// Admin users bypass permission checks
		if (requestLimit > threshold && !isAdmin) {
			// For xlsx, also check xls (legacy format) in metadata
			const exportLargePermissions = normalizedType === 'xlsx' && !access?.exportLarge?.[normalizedType]
				? access?.exportLarge?.xls
				: access?.exportLarge?.[normalizedType];
			
			if (!exportLargePermissions || !exportLargePermissions.includes('list')) {
				const durationMs = Date.now() - exportStartTime;
				tracingSpan.end();
				
				// Log denied large export
				const { logExportToAccessLog } = await import('@imports/audit/accessLogExport');
				await logExportToAccessLog(authTokenId, {
					document,
					listName,
					type: normalizedType as 'csv' | 'xlsx' | 'json',
					start: req.query.start ?? 0,
					limit: requestLimit,
					threshold,
					status: 'denied',
					reason: `No exportLarge permission for type: ${normalizedType} (limit ${requestLimit} exceeds threshold ${threshold})`,
					durationMs,
				});
				
				const errorResult = errorReturn([
					{
						code: 'export.error.largeDataset.denied',
						message: `This export contains more than ${threshold} records. Contact your administrator to export large datasets`,
						details: JSON.stringify({ document, threshold, limit: requestLimit }),
					},
				]);
				return reply.status(403).type('application/json').send(errorResult);
			}
		}

		// Parse filter from query string
		const parsedFilter: KonFilter | undefined = req.query.filter != null
			? isString(req.query.filter)
				? (() => {
						try {
							return JSON.parse(req.query.filter.replace(/\+/g, ' ')) as KonFilter;
						} catch {
							return undefined;
						}
					})()
				: isObject(req.query.filter)
					? (req.query.filter as KonFilter)
					: undefined
			: undefined;

		try {
			const result = await exportData({
				document,
				listName,
				type: normalizedType as 'csv' | 'xlsx' | 'json',
				user,
				filter: req.query.filter,
				sort: req.query.sort,
				fields: req.query.fields,
				displayName: req.query.displayName,
				displayType: req.query.displayType,
				limit: requestLimit,
				start: req.query.start,
				tracingSpan,
			});

			if (result.success === false) {
				const durationMs = Date.now() - exportStartTime;
				
				// Log export error
				const { logExportToAccessLog } = await import('@imports/audit/accessLogExport');
				await logExportToAccessLog(authTokenId, {
					document,
					listName,
					type: normalizedType as 'csv' | 'xlsx' | 'json',
					start: req.query.start ?? 0,
					limit: requestLimit,
					threshold,
					status: 'error',
					reason: result.errors?.[0]?.message ?? 'Unknown export error',
					durationMs,
				});
				
				tracingSpan.end();
				return reply.status(500).type('application/json').send(result);
			}

			const durationMs = Date.now() - exportStartTime;
			
			// Log successful export
			const { logExportToAccessLog, sanitizeFieldsForLog } = await import('@imports/audit/accessLogExport');
			await logExportToAccessLog(authTokenId, {
				document,
				listName,
				type: normalizedType as 'csv' | 'xlsx' | 'json',
				start: req.query.start ?? 0,
				limit: requestLimit,
				threshold,
				fields: sanitizeFieldsForLog(req.query.fields),
				filter: parsedFilter, // Pass the parsed filter object
				sort: req.query.sort,
				status: 'success',
				durationMs,
			});

			tracingSpan.addEvent('Setting headers', result.data.httpHeaders);
			Object.entries(result.data.httpHeaders).forEach(([header, value]) => {
				reply.header(header, value);
			});

			tracingSpan.end();

			return reply.send(result.data.content);
		} catch (error) {
			const durationMs = Date.now() - exportStartTime;
			const errorMsg = error instanceof Error ? error.message : String(error);
			
			// Log export exception
			const { logExportToAccessLog } = await import('@imports/audit/accessLogExport');
			await logExportToAccessLog(authTokenId, {
				document,
				listName,
				type: normalizedType as 'csv' | 'xlsx' | 'json',
				start: req.query.start ?? 0,
				limit: requestLimit,
				threshold,
				status: 'error',
				reason: `Exception: ${errorMsg}`,
				durationMs,
			});
			
			tracingSpan.end();
			const errorResult = errorReturn([
				{
					code: 'export.error.generic',
					message: 'Unable to export data. Please try again or contact support',
					details: JSON.stringify({ document, error: errorMsg }),
				},
			]);
			return reply.status(500).type('application/json').send(errorResult);
		}
	});

	fastify.get<{
		Params: { document: string };
		Querystring: {
			displayName?: string;
			displayType?: string;
			fields?: string;
			filter?: string | object;
			sort?: string;
			limit?: string;
			start?: string;
			withDetailFields?: string;
			pivotConfig?: string;
		};
	}>('/rest/data/:document/pivot', {
		// Pivot tables can take a long time to process large datasets
		config: {
			// 10 minutes timeout for pivot operations
			timeout: 600000,
		},
	}, async (req, reply) => {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET pivot');

		const authTokenId = getAuthTokenIdFromReq(req);
		tracingSpan.setAttribute('authTokenId', authTokenId ?? 'undefined');
		tracingSpan.setAttribute('document', req.params.document);

		// Parse filter from query string
		const { logger } = await import('@imports/utils/logger');
		logger.info(`[dataApi] Raw filter from query: ${JSON.stringify(req.query.filter)}`);
		
		const parsedFilter: KonFilter | undefined = req.query.filter != null
			? isString(req.query.filter)
				? (() => {
						try {
							const parsed = JSON.parse(req.query.filter.replace(/\+/g, ' ')) as KonFilter;
							logger.info(`[dataApi] Parsed filter (string): ${JSON.stringify(parsed)}`);
							return parsed;
						} catch (error) {
							logger.error(`[dataApi] Error parsing filter: ${(error as Error).message}`);
							return undefined;
						}
					})()
				: isObject(req.query.filter)
					? (() => {
							const parsed = req.query.filter as KonFilter;
							logger.info(`[dataApi] Parsed filter (object): ${JSON.stringify(parsed)}`);
							return parsed;
						})()
					: undefined
			: (() => {
					logger.warn(`[dataApi] No filter in query string!`);
					return undefined;
				})();

		// Parse pivotConfig from query string
		let pivotConfigParseError: string | undefined;
		const pivotConfig: PivotConfig | undefined = req.query.pivotConfig != null
			? isString(req.query.pivotConfig)
				? (() => {
						try {
							return JSON.parse(req.query.pivotConfig.replace(/\+/g, ' ')) as PivotConfig;
						} catch (error) {
							pivotConfigParseError = `[${req.params.document}] Invalid pivotConfig format: ${(error as Error).message}`;
							return undefined;
						}
					})()
				: isObject(req.query.pivotConfig)
					? (req.query.pivotConfig as PivotConfig)
					: undefined
			: undefined;

		// Validate pivotConfig
		if (pivotConfigParseError != null) {
			tracingSpan.end();
			return errorReturn(pivotConfigParseError);
		}

		if (pivotConfig == null) {
			tracingSpan.end();
			return errorReturn(`[${req.params.document}] pivotConfig is required`);
		}

		if (!Array.isArray(pivotConfig.rows) || pivotConfig.rows.length === 0) {
			tracingSpan.end();
			return errorReturn(`[${req.params.document}] pivotConfig.rows is required and must be a non-empty array`);
		}

		if (!Array.isArray(pivotConfig.values) || pivotConfig.values.length === 0) {
			tracingSpan.end();
			return errorReturn(`[${req.params.document}] pivotConfig.values is required and must be a non-empty array`);
		}

		// Extract language from Accept-Language header (default to pt_BR)
		const acceptLanguage = req.headers['accept-language'] || 'pt-BR';
		const lang = acceptLanguage.startsWith('pt') ? 'pt_BR' : 'en';

		// Call pivotStream
		const result = await pivotStream({
			authTokenId,
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: parsedFilter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			pivotConfig,
			lang,
			tracingSpan,
		});

		tracingSpan.end();
		reply.send(result);
	});

	fastify.get<{
		Params: { document: string };
		Querystring: {
			displayName?: string;
			displayType?: string;
			fields?: string;
			filter?: string | object;
			sort?: string;
			limit?: string;
			start?: string;
			withDetailFields?: string;
			graphConfig?: string;
		};
	}>('/rest/data/:document/graph', async (req, reply) => {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET graph');

		const authTokenId = getAuthTokenIdFromReq(req);
		tracingSpan.setAttribute('authTokenId', authTokenId ?? 'undefined');
		tracingSpan.setAttribute('document', req.params.document);

		// Parse filter from query string
		const { logger } = await import('@imports/utils/logger');
		logger.info(`[dataApi] Raw filter from query: ${JSON.stringify(req.query.filter)}`);

		const parseFilterResult = (() => {
			if (req.query.filter == null) {
				logger.warn(`[dataApi] No filter in query string!`);
				return { success: true as const, data: undefined as KonFilter | undefined };
			}
			if (isString(req.query.filter)) {
				try {
					const parsed = JSON.parse(req.query.filter.replace(/\+/g, ' ')) as KonFilter;
					logger.info(`[dataApi] Parsed filter (string): ${JSON.stringify(parsed)}`);
					return { success: true as const, data: parsed };
				} catch (error) {
					logger.error(`[dataApi] Error parsing filter: ${(error as Error).message}`);
					tracingSpan.end();
					const errorMsg = getGraphErrorMessage('GRAPH_FILTER_INVALID', {
						document: req.params.document,
						details: (error as Error).message
					});
					return {
						success: false as const,
						error: errorReturn([{ message: errorMsg.message, code: errorMsg.code, details: errorMsg.details } as KonectyError]),
					};
				}
			}
			if (isObject(req.query.filter)) {
				const parsed = req.query.filter as KonFilter;
				logger.info(`[dataApi] Parsed filter (object): ${JSON.stringify(parsed)}`);
				return { success: true as const, data: parsed };
			}
			return { success: true as const, data: undefined as KonFilter | undefined };
		})();

		if (!parseFilterResult.success) {
			return parseFilterResult.error;
		}
		const parsedFilter = parseFilterResult.data;

		// Parse graphConfig from query string
		const parseGraphConfigResult = (() => {
			if (req.query.graphConfig == null) {
				return { success: true as const, data: undefined as GraphConfig | undefined };
			}
			if (isString(req.query.graphConfig)) {
				try {
					return { success: true as const, data: JSON.parse(req.query.graphConfig.replace(/\+/g, ' ')) as GraphConfig };
				} catch (error) {
					tracingSpan.end();
					const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_INVALID', {
						document: req.params.document,
						details: (error as Error).message
					});
					return {
						success: false as const,
						error: errorReturn([{ message: errorMsg.message, code: errorMsg.code, details: errorMsg.details } as KonectyError]),
					};
				}
			}
			if (isObject(req.query.graphConfig)) {
				return { success: true as const, data: req.query.graphConfig as GraphConfig };
			}
			return { success: true as const, data: undefined as GraphConfig | undefined };
		})();

		if (!parseGraphConfigResult.success) {
			return parseGraphConfigResult.error;
		}
		const graphConfig = parseGraphConfigResult.data;

		// Validate graphConfig
		if (graphConfig == null) {
			tracingSpan.end();
			const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_MISSING');
			return errorReturn([{ message: errorMsg.message, code: errorMsg.code } as KonectyError]);
		}

		if (!graphConfig.type) {
			tracingSpan.end();
			const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_TYPE_MISSING');
			return errorReturn([{ message: errorMsg.message, code: errorMsg.code } as KonectyError]);
		}

		// Validate graphConfig based on type
		if (['bar', 'line', 'scatter', 'timeSeries'].includes(graphConfig.type)) {
			if (!graphConfig.xAxis || !graphConfig.xAxis.field) {
				tracingSpan.end();
				const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_AXIS_X_MISSING', { type: graphConfig.type });
				return errorReturn([{ message: errorMsg.message, code: errorMsg.code } as KonectyError]);
			}
			if (!graphConfig.yAxis || !graphConfig.yAxis.field) {
				tracingSpan.end();
				const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_AXIS_Y_MISSING', { type: graphConfig.type });
				return errorReturn([{ message: errorMsg.message, code: errorMsg.code } as KonectyError]);
			}
		} else if (graphConfig.type === 'pie') {
			if (!graphConfig.categoryField && (!graphConfig.yAxis || !graphConfig.yAxis.field)) {
				tracingSpan.end();
				const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_CATEGORY_MISSING');
				return errorReturn([{ message: errorMsg.message, code: errorMsg.code } as KonectyError]);
			}
		} else if (graphConfig.type === 'histogram') {
			if (!graphConfig.yAxis || !graphConfig.yAxis.field) {
				tracingSpan.end();
				const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_AXIS_Y_MISSING', { type: 'histogram' });
				return errorReturn([{ message: errorMsg.message, code: errorMsg.code } as KonectyError]);
			}
		}

		// Extract language from Accept-Language header (default to pt_BR)
		const acceptLanguage = req.headers['accept-language'] || 'pt-BR';
		const lang = acceptLanguage.startsWith('pt') ? 'pt_BR' : 'en';

		// Set default limit to 100k if not provided (similar to pivot)
		const GRAPH_MAX_RECORDS = parseInt(process.env.GRAPH_MAX_RECORDS ?? '100000', 10);
		const limit = req.query.limit ? parseInt(req.query.limit, 10) : GRAPH_MAX_RECORDS;

		// Call graphStream
		const result = await graphStream({
			authTokenId,
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: parsedFilter,
			sort: req.query.sort,
			limit: String(limit),
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			graphConfig,
			lang,
			tracingSpan,
		});

		tracingSpan.end();

		if (result.success === false) {
			return reply.status(400).send(result);
		}

		reply.type('image/svg+xml');
		reply.send(result.svg);
	});

	done();
};

export default fp(dataApi);
