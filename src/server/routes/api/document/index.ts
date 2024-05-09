import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getUserFromRequest } from '@imports/auth/getUser';
import { getDocument } from '@imports/document';
import { logger } from '@imports/utils/logger';

const documentAPi: FastifyPluginCallback = async fastify => {
	fastify.get<{ Params: { name: string } }>('/api/document/:name', async (req, reply) => {
		if (req.originalUrl == null || req.params == null) {
			return reply.status(404).send('Not found');
		}

		const name = req.params.name;

		if (name == null) {
			return reply.status(400).send('Bad request');
		}

		try {
			const user = await getUserFromRequest(req);

			if (user == null) {
				return reply.status(401).send('Unauthorized');
			}

			const result = await getDocument(name);

			if (result == null) {
				return reply.status(404).send('Invalid meta object');
			}

			return reply.send(result);
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}

			logger.error(error, `Error getting document for ${name}`);
			return reply.status(500).send('Internal server error');
		}
	});
};

export default fp(documentAPi);
