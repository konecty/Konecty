import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { MetaObject } from '@imports/model/MetaObject';

import { logger } from '@imports/utils/logger';

const healthApi: FastifyPluginCallback = (fastify, opts, done) => {
	fastify.get('/readiness', { logLevel: 'silent' }, (_, reply) => {
		reply.send('OK');
	});

	fastify.get('/liveness', { logLevel: 'silent' }, async (_, reply) => {
		try {
			await MetaObject.MetaObject.findOne({ _id: 'Namespace' } as any);
			reply.send('OK');
		} catch (error) {
			logger.error(error, `Error on liveness (${new Date().toISOString()}): ${(error as Error).message}`);
			reply.status(503).send('The king is dead, long live the king!');
		}
	});

	done();
};

export default fp(healthApi);
