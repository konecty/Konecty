import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';

const translationApi: FastifyPluginCallback = async fastify => {
	fastify.get<{ Querystring: { asImage?: string } }>('/api/info/logo', async (req, reply) => {
		const asImage = req.query.asImage != null;

		try {
			const { logoURL } = MetaObject.Namespace;
			if (logoURL == null) {
				return reply.status(404).send('Logo url not found');
			}

			if (asImage) {
				const response = await fetch(logoURL);
				return reply.send(response.body);
			}

			return reply.send({ success: true, data: logoURL });
		} catch (error) {
			logger.error(error, `Error getting logo url`);
			return reply.status(500).send('Internal server error');
		}
	});
};

export default fp(translationApi);
