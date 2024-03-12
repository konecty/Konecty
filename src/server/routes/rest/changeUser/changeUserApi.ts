import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { addUser, countInactive, defineUser, removeUser, replaceUser, removeInactive, setQueue } from '@imports/data/changeUser';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

const changeUserApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.post<{ Params: { document: string }; Body: { ids: Array<unknown>; data: unknown } }>('/rest/changeUser/:document/add', async (req, reply) => {
		const result = await addUser({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		});

		reply.send(result);
	});

	fastify.post<{ Params: { document: string }; Body: { ids: Array<unknown>; data: unknown } }>('/rest/changeUser/:document/remove', async (req, reply) => {
		const result = await removeUser({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		});

		reply.send(result);
	});

	fastify.post<{ Params: { document: string }; Body: { ids: Array<unknown>; data: unknown } }>('/rest/changeUser/:document/define', async (req, reply) => {
		const result = await defineUser({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		});

		reply.send(result);
	});

	fastify.post<{
		Params: { document: string };
		Body: {
			ids: Array<unknown>;
			data?: {
				from?: unknown;
				to?: unknown;
			};
		};
	}>('/rest/changeUser/:document/replace', async (req, reply) => {
		const result = await replaceUser({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			from: req?.body?.data?.from,
			to: req?.body?.data?.to,
		});

		reply.send(result);
	});

	fastify.post<{ Params: { document: string }; Body: { ids: Array<unknown> } }>('/rest/changeUser/:document/countInactive', async (req, reply) => {
		const result = await countInactive({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
		});

		reply.send(result);
	});

	fastify.post<{ Params: { document: string }; Body: { ids: Array<unknown> } }>('/rest/changeUser/:document/removeInactive', async (req, reply) => {
		const result = await removeInactive({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
		});

		reply.send(result);
	});

	fastify.post<{ Params: { document: string }; Body: { ids: Array<unknown>; data: unknown } }>('/rest/changeUser/:document/setQueue', async (req, reply) => {
		const result = await setQueue({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			queue: req.body.data,
		});

		reply.send(result);
	});

	done();
};

export default fp(changeUserApi);
