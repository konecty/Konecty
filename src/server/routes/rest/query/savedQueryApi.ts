import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import {
	listSavedQueries,
	getSavedQueryById,
	createSavedQuery,
	updateSavedQuery,
	deleteSavedQuery,
	shareSavedQuery,
} from '@imports/query/savedQueriesRepo';
import { errorReturn } from '@imports/utils/return';

export const savedQueryApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get('/rest/query/saved', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		if (userResult.success === false) {
			reply.status(401).send({ success: false, errors: userResult.errors });
			return;
		}

		const list = await listSavedQueries(userResult.data);
		reply.send({ success: true, data: list });
	});

	fastify.get<{ Params: { id: string } }>('/rest/query/saved/:id', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		if (userResult.success === false) {
			reply.status(401).send({ success: false, errors: userResult.errors });
			return;
		}

		const item = await getSavedQueryById(req.params.id, userResult.data);
		if (item == null) {
			reply.status(404).send(errorReturn('Saved query not found'));
			return;
		}

		reply.send({ success: true, data: item });
	});

	fastify.post<{ Body: unknown }>('/rest/query/saved', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		if (userResult.success === false) {
			reply.status(401).send({ success: false, errors: userResult.errors });
			return;
		}

		try {
			const created = await createSavedQuery(req.body, userResult.data);
			reply.status(201).send({ success: true, data: created });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			reply.status(400).send(errorReturn(message));
		}
	});

	fastify.put<{ Params: { id: string }; Body: unknown }>('/rest/query/saved/:id', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		if (userResult.success === false) {
			reply.status(401).send({ success: false, errors: userResult.errors });
			return;
		}

		try {
			const updated = await updateSavedQuery(req.params.id, req.body, userResult.data);
			if (updated == null) {
				reply.status(404).send(errorReturn('Saved query not found or not authorized'));
				return;
			}
			reply.send({ success: true, data: updated });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			reply.status(400).send(errorReturn(message));
		}
	});

	fastify.delete<{ Params: { id: string } }>('/rest/query/saved/:id', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		if (userResult.success === false) {
			reply.status(401).send({ success: false, errors: userResult.errors });
			return;
		}

		const deleted = await deleteSavedQuery(req.params.id, userResult.data);
		if (!deleted) {
			reply.status(404).send(errorReturn('Saved query not found or not authorized'));
			return;
		}

		reply.send({ success: true });
	});

	fastify.patch<{ Params: { id: string }; Body: unknown }>('/rest/query/saved/:id/share', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);
		if (userResult.success === false) {
			reply.status(401).send({ success: false, errors: userResult.errors });
			return;
		}

		try {
			const updated = await shareSavedQuery(req.params.id, req.body, userResult.data);
			if (updated == null) {
				reply.status(404).send(errorReturn('Saved query not found or not authorized'));
				return;
			}
			reply.send({ success: true, data: updated });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			reply.status(400).send(errorReturn(message));
		}
	});

	done();
};

export default fp(savedQueryApi);
