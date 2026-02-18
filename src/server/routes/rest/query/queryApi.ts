import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import crossModuleQuery from '@imports/data/api/crossModuleQuery';
import { NEWLINE_SEPARATOR } from '@imports/data/api/streamConstants';

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

		if (result.success === false) {
			return reply.status(400).send(result);
		}

		if (result.total != null) {
			reply.header('X-Total-Count', String(result.total));
		}

		reply.type('application/x-ndjson');

		const includeMeta = (req.body as Record<string, unknown>)?.includeMeta !== false;
		let body = '';

		if (includeMeta) {
			body += JSON.stringify({ _meta: result.meta }) + NEWLINE_SEPARATOR;
		}

		for (const record of result.records) {
			body += JSON.stringify(record) + NEWLINE_SEPARATOR;
		}

		return reply.send(body);
	});

	done();
};

export default fp(queryApi);
