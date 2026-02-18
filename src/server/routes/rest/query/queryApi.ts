import { FastifyPluginCallback, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import crossModuleQuery from '@imports/data/api/crossModuleQuery';
import { NEWLINE_SEPARATOR } from '@imports/data/api/streamConstants';
import { sqlToIQR, SqlParseError } from '@imports/data/api/sqlToRelationsParser';
import { logger } from '@imports/utils/logger';

const SQL_LOG_PREVIEW_LENGTH = 200;

const SqlQueryBodySchema = z.object({
	sql: z.string().min(1),
	includeTotal: z.boolean().default(true),
	includeMeta: z.boolean().default(false),
});

function sendMetaError(reply: FastifyReply, statusCode: number, errors: Array<{ message: string }>): void {
	reply.status(statusCode).type('application/x-ndjson').send(JSON.stringify({ _meta: { success: false, errors } }) + NEWLINE_SEPARATOR);
}

async function sendCrossModuleResponse(
	reply: FastifyReply,
	result: { success: true; meta: any; records: Record<string, unknown>[]; total?: number } | { success: false; errors: any },
	includeMeta: boolean,
): Promise<void> {
	if (result.success === false) {
		const errors = Array.isArray(result.errors) ? result.errors : [{ message: String(result.errors) }];
		sendMetaError(reply, 400, errors);
		return;
	}

	if (result.total != null) {
		reply.header('X-Total-Count', String(result.total));
	}

	reply.type('application/x-ndjson');

	let body = '';

	if (includeMeta) {
		const meta = { success: true, ...result.meta };
		if (result.total != null) {
			meta.total = result.total;
		}
		body += JSON.stringify({ _meta: meta }) + NEWLINE_SEPARATOR;
	}

	for (const record of result.records) {
		body += JSON.stringify(record) + NEWLINE_SEPARATOR;
	}

	reply.send(body);
}

export const queryApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.post<{
		Body: unknown;
	}>('/rest/query/json', async (req, reply) => {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('POST query/json');

		const result = await crossModuleQuery({
			authTokenId: getAuthTokenIdFromReq(req),
			body: req.body,
			tracingSpan,
		});

		tracingSpan.end();

		const includeMeta = (req.body as Record<string, unknown>)?.includeMeta === true;
		await sendCrossModuleResponse(reply, result, includeMeta);
	});

	fastify.post<{
		Body: unknown;
	}>('/rest/query/sql', async (req, reply) => {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('POST query/sql');

		try {
			const parsed = SqlQueryBodySchema.safeParse(req.body);
			if (!parsed.success) {
				tracingSpan.end();
				const messages = parsed.error.issues.map(issue => ({
					message: `${issue.path.join('.')}: ${issue.message}`,
				}));
				sendMetaError(reply, 400, messages);
				return;
			}

			const { sql, includeTotal, includeMeta } = parsed.data;

			logger.debug({ sqlLength: sql.length, firstChars: sql.substring(0, SQL_LOG_PREVIEW_LENGTH) }, '[queryApi] SQL query received');

			const iqr = sqlToIQR(sql);

			const body = { ...iqr, includeTotal, includeMeta };

			const result = await crossModuleQuery({
				authTokenId: getAuthTokenIdFromReq(req),
				body,
				tracingSpan,
			});

			tracingSpan.end();

			await sendCrossModuleResponse(reply, result, includeMeta);
		} catch (err) {
			tracingSpan.end();

			if (err instanceof SqlParseError) {
				sendMetaError(reply, 400, [{ message: err.message }]);
				return;
			}

			logger.error(err, '[queryApi] Unexpected error in SQL query');
			sendMetaError(reply, 500, [{ message: 'Internal server error processing SQL query' }]);
		}
	});

	done();
};

export default fp(queryApi);
