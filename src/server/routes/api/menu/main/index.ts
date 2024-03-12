import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getUserFromRequest } from '@imports//auth/getUser';
import { logger } from '@imports//utils/logger';
import { mainMenu } from '@imports//menu/main';

const mainMenuApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get('/api/menu/main', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);

			if (user == null) {
				return reply.status(401).send('Unauthorized');
			}

			const result = await mainMenu(user);

			return reply.send(result);
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}
			logger.error(error, 'Error getting main menu');
			return reply.status(500).send('Internal server error');
		}
	});

	done();
};

export default fp(mainMenuApi);
