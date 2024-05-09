import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import get from 'lodash/get';

import path from 'path';
import { buildI18N } from '@imports/lib/buildI18N';
import { getUserFromRequest } from '@imports/auth/getUser';
import { logger } from '@imports/utils/logger';

const translationApi: FastifyPluginCallback = async fastify => {
	fastify.get<{ Params: { lang: string } }>('/api/translation/:lang', async (req, reply) => {
		const lang = path.basename(req.params.lang, '.json') ?? 'en';

		try {
			const user = await getUserFromRequest(req);

			if (user == null) {
				return reply.status(401).send('Unauthorized');
			}

			const translations = await buildI18N(user);

			const translation = get(translations, lang);

			if (translation == null) {
				return reply.status(404).send('Not found');
			}

			return reply.send(translation);
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}
			logger.error(error, `Error getting translation for ${lang}`);
			return reply.status(500).send('Internal server error');
		}
	});
};

export default fp(translationApi);
