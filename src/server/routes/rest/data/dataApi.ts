import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

import { find } from '@imports/data/api';
import { create, deleteData, findById, findByLookup, getNextUserFromQueue, historyFind, relationCreate, saveLead, update } from '@imports/data/data';

import { getUserSafe } from '@imports/auth/getUser';
import { getAccessFor } from '@imports/utils/accessUtils';
import { errorReturn } from '@imports/utils/return';

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
			req.query.filter = JSON.parse(decodeURIComponent(req.query.filter));
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
		Params: { document: string; listName: string; type: 'csv' | 'xls' };
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

		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		tracingSpan.setAttribute('authTokenId', authTokenId ?? 'undefined');

		if (userResult.success === false) {
			return userResult;
		}

		const user = userResult.data;
		const { document, listName, type } = req.params;
		tracingSpan.setAttributes(req.params);

		const access = getAccessFor(document, user);
		if (access === false || access.isReadable !== true) {
			return errorReturn(`[${document}] You don't have permission to read records`);
		}

		if (['csv', 'xls'].includes(type) === false) {
			return errorReturn(`[${document}] Value for type must be one of [csv, xls]`);
		}

		const result = await exportData({
			document,
			listName,
			type,
			user,
			filter: req.query.filter,
			sort: req.query.sort,
			fields: req.query.fields,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			limit: req.query.limit,
			start: req.query.start,
			tracingSpan,
		});

		if (result.success === false) {
			return result;
		}

		tracingSpan.addEvent('Setting headers', result.data.httpHeaders);
		for (const [header, value] of Object.entries(result.data.httpHeaders)) {
			reply.header(header, value);
		}

		tracingSpan.end();

		return reply.send(result.data.content);
	});

	done();
};

export default fp(dataApi);
