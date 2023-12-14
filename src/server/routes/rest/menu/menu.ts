import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { menuFull, metaDocuments, metaDocument } from '@imports/menu/legacy';

const menuApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get('/rest/menu/list', async function (req, reply) {
		const result = await menuFull({ authTokenId: getAuthTokenIdFromReq(req) });
		reply.send(result);
	});

	fastify.get('/rest/menu/documents', async function (req, reply) {
		const result = await metaDocuments({ authTokenId: getAuthTokenIdFromReq(req) });
		reply.send(result);
	});

	fastify.get<{ Params: { document: string } }>('/rest/menu/documents/:document', async function (req, fastify) {
		const result = await metaDocument({ document: req.params.document, authTokenId: getAuthTokenIdFromReq(req) } as any);
		fastify.send(result);
	});

	done();
};

export default fp(menuApi);
