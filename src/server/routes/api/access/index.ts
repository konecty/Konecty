import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import getAccessForDocument from '@imports/access/getAccessForDocument';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

const accessApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get<{ Params: { document: string } }>('/rest/access/:document', async function (req, reply) {
		const result = await getAccessForDocument({ document: req.params.document, authTokenId: getAuthTokenIdFromReq(req) ?? 'no-token' });
		reply.send(result);
	});

	done();
};

export default fp(accessApi);
