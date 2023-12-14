import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { processSubmit } from '@imports/data/process';

const processApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.post<{ Body: { data: unknown } }>('/rest/process/submit', async function (req, reply) {
		const result = await processSubmit({
			authTokenId: getAuthTokenIdFromReq(req),
			data: req.body.data,
		} as any);

		reply.send(result);
	});

	done();
};

export default fp(processApi);
