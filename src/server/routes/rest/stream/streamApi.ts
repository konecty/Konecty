import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import isString from 'lodash/isString';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

import { find } from '@imports/data/data';

export const streamApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get<{
		Params: { document: string };
		Querystring: { displayName: string; displayType: string; fields: string; filter: string; sort: string; limit: string; start: string; withDetailFields: string };
	}>('/rest/stream/:document/find', async (req, reply) => {
		if (req.query.filter != null && isString(req.query.filter)) {
			req.query.filter = JSON.parse(req.query.filter.replace(/\+/g, ' '));
		}

		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET stream/find');

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

	done();
};

export default fp(streamApi);
