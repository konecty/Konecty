import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { findComments, createComment } from '@imports/data/comments';

const commentApi: FastifyPluginCallback = async fastify => {
	fastify.get<{ Params: { document: string; dataId: string } }>('/rest/comment/:document/:dataId', async (req, reply) => {
		const result = await findComments({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
		});

		return reply.send(result);
	});

	fastify.post<{ Params: { document: string; dataId: string }; Body: { text: string } }>('/rest/comment/:document/:dataId', async (req, reply) => {
		const result = await createComment({
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
			text: req.body.text,
		});

		return reply.send(result);
	});
};

export default fp(commentApi);
