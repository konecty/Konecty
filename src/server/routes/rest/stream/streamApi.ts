import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import isString from 'lodash/isString';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { KonFilter } from '@imports/model/Filter';

import { find, findStream } from '@imports/data/api';

function parseFilterFromQuery(filter: string | KonFilter | undefined): KonFilter | undefined {
	if (filter == null) {
		return undefined;
	}

	if (isString(filter)) {
		return JSON.parse(filter.replace(/\+/g, ' ')) as KonFilter;
	}

	return filter as KonFilter;
}

export const streamApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get<{
		Params: { document: string };
		Querystring: { displayName: string; displayType: string; fields: string; filter: string; sort: string; limit: string; start: string; withDetailFields: string };
	}>('/rest/stream/:document/find', async (req, reply) => {
		const parsedFilter = parseFilterFromQuery(req.query.filter);

		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET stream/find');

		const result = await find({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: parsedFilter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			getTotal: true,
			asStream: true,
			tracingSpan,
		} as any);

		tracingSpan.end();
		reply.send(result);
	});

	fastify.get<{
		Params: { document: string };
		Querystring: {
			displayName: string;
			displayType: string;
			fields: string;
			filter: string;
			sort: string;
			limit: string;
			start: string;
			withDetailFields: string;
			includeTotal?: string;
		};
	}>('/rest/stream/:document/findStream', async (req, reply) => {
		const parsedFilter = parseFilterFromQuery(req.query.filter);
		const includeTotal = req.query.includeTotal === '1' || req.query.includeTotal === 'true';

		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET stream/findStream');

		const result = await findStream({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: parsedFilter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			getTotal: includeTotal,
			transformDatesToString: true,
			tracingSpan,
		});

		tracingSpan.end();

		if (result.success === false) {
			return reply.status(500).send(result);
		}

		if (includeTotal && typeof result.total === 'number') {
			reply.header('X-Total-Count', String(result.total));
		}

		// Send stream directly - Fastify will handle HTTP streaming
		return reply.type('application/json').send(result.data);
	});

	fastify.get<{
		Params: { document: string };
		Querystring: { displayName?: string; displayType?: string; filter?: string; sort?: string; withDetailFields?: string };
	}>('/rest/stream/:document/count', async (req, reply) => {
		const parsedFilter = parseFilterFromQuery(req.query.filter);

		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET stream/count');

		// Reuse existing find() to compute total. We keep payload minimal with limit=1 and fields=_id.
		const result = await find({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: '_id',
			filter: parsedFilter,
			sort: req.query.sort,
			limit: 1,
			start: 0,
			withDetailFields: req.query.withDetailFields,
			getTotal: true,
			tracingSpan,
		} as any);

		tracingSpan.end();

		if (result.success === false) {
			return reply.status(500).send(result);
		}

		return reply.send({ success: true, total: (result as any).total ?? 0 });
	});

	done();
};

export default fp(streamApi);
