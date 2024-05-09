import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getUserFromRequest } from '@imports/auth/getUser';
import { logger } from '@imports/utils/logger';
import { listView } from '@imports/list-view';

const listViewApi: FastifyPluginCallback = async fastify => {
	fastify.get<{ Params: { document: string; id: string } }>('/api/list-view/:document/:id', async (req, reply) => {
		if (req.originalUrl == null || req.params == null) {
			return reply.status(404).send('Not found');
		}

		const document = req.params.document;
		const id = req.params.id;

		if (document == null || id == null) {
			return reply.status(400).send('Bad request');
		}

		try {
			const user = await getUserFromRequest(req);

			if (user == null) {
				return reply.status(401).send('Unauthorized');
			}

			const result = await listView(document, id);

			if (result == null) {
				return reply.status(404).send('Invalid meta object');
			}

			return reply.send(result);
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}
			logger.error(error, `Error getting list view for ${document}/${id}}`);
			return reply.status(500).send('Internal server error');
		}
	});
};

export default fp(listViewApi);
