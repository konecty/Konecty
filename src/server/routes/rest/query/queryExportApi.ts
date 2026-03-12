import { Readable } from 'stream';
import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { getAccessFor } from '@imports/utils/accessUtils';
import { MetaObject } from '@imports/model/MetaObject';
import crossModuleQuery from '@imports/data/api/crossModuleQuery';
import { ExportDataResponse } from '@imports/data/export';
import csvExport from '@imports/exports/csvExport';
import xlsExport from '@imports/exports/xlsExport';
import jsonExport from '@imports/exports/jsonExport';
import { KonectyResult } from '@imports/types/result';
import { errorReturn } from '@imports/utils/return';
import { logger } from '@imports/utils/logger';

const VALID_FORMATS = ['csv', 'xlsx', 'json'] as const;
type ExportFormat = (typeof VALID_FORMATS)[number];

function recordsToReadable(records: Record<string, unknown>[]): Readable {
	let index = 0;
	return new Readable({
		objectMode: true,
		read() {
			if (index < records.length) {
				this.push(records[index++]);
			} else {
				this.push(null);
			}
		},
	});
}

export const queryExportApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.post<{
		Params: { format: string };
		Body: unknown;
	}>('/rest/query/export/:format', async (req, reply) => {
		const format = req.params.format as ExportFormat;
		if (!VALID_FORMATS.includes(format)) {
			reply.status(400).send(errorReturn(`Invalid format: ${format}. Must be csv, xlsx, or json.`));
			return;
		}

		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		if (userResult.success === false) {
			reply.status(401).send({ success: false, errors: userResult.errors });
			return;
		}

		const body = req.body as Record<string, unknown>;
		const document = typeof body?.document === 'string' ? body.document : null;
		if (document == null) {
			reply.status(400).send(errorReturn('Missing document in request body'));
			return;
		}

		const meta = MetaObject.Meta[document];
		if (meta == null) {
			reply.status(404).send(errorReturn(`Document ${document} not found`));
			return;
		}

		const access = getAccessFor(document, userResult.data);
		if (access === false || access.isReadable !== true) {
			reply.status(403).send(errorReturn('No read access to this document'));
			return;
		}

		const startTime = Date.now();

		try {
			const queryResult = await crossModuleQuery({
				authTokenId,
				body: { ...body, includeMeta: true, includeTotal: true },
			});

			if (queryResult == null || !('success' in queryResult) || queryResult.success !== true) {
				const errorMsg =
					queryResult != null && 'errors' in queryResult
						? (queryResult as { errors?: Array<{ message: string }> }).errors?.[0]?.message ?? 'Query failed'
						: 'Query execution failed';
				reply.status(500).send(errorReturn(errorMsg));
				return;
			}

			const dataStream = recordsToReadable(queryResult.records);
			const name = `data-explorer-${document}`;

			const fieldsStr = typeof body?.fields === 'string' ? body.fields : undefined;
			const columns = fieldsStr
				? fieldsStr
						.split(',')
						.map((f: string) => f.trim())
						.filter(Boolean)
				: undefined;
			const exportOptions = columns != null && columns.length > 0 ? { columns } : undefined;

			let exportResultPromise: Promise<KonectyResult<ExportDataResponse>>;
			if (format === 'csv') {
				reply.header('Content-Type', 'text/csv; charset=utf-8');
				reply.header('Content-Disposition', `attachment; filename="${name}.csv"`);
				exportResultPromise = csvExport(dataStream, name, exportOptions);
			} else if (format === 'xlsx') {
				reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
				reply.header('Content-Disposition', `attachment; filename="${name}.xlsx"`);
				exportResultPromise = xlsExport(dataStream, name, exportOptions);
			} else {
				reply.header('Content-Type', 'application/json; charset=utf-8');
				reply.header('Content-Disposition', `attachment; filename="${name}.json"`);
				exportResultPromise = jsonExport(dataStream, name);
			}

			const exportResult = await exportResultPromise;
			if (exportResult.success !== true || exportResult.data?.content == null) {
				const errMsg = exportResult && 'errors' in exportResult ? String((exportResult as { errors?: unknown }).errors) : 'Export failed';
				reply.status(500).send(errorReturn(errMsg));
				return;
			}

			const durationMs = Date.now() - startTime;
			logger.info({ document, format, durationMs, userId: (userResult.data as { _id?: string })._id }, 'Data explorer export completed');

			try {
				const { logExportToAccessLog } = await import('@imports/audit/accessLogExport');
				await logExportToAccessLog(authTokenId, {
					document,
					listName: 'data-explorer',
					type: format,
					start: 0,
					limit: typeof body.limit === 'number' ? body.limit : 1000,
					threshold: 1000,
					status: 'success',
					durationMs,
				});
			} catch {
				// audit log failure should not break the export
			}

			return reply.send(exportResult.data.content);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.error({ err, document, format }, 'Data explorer export failed');
			reply.status(500).send(errorReturn(message));
		}
	});

	done();
};

export default fp(queryExportApi);
