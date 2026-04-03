import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { getExplorerModules } from '@imports/data/api/explorerModules';

const LANG_QUERY_DEFAULT = 'pt_BR';

export const explorerMetaApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get<{
		Querystring: { lang?: string };
	}>('/rest/query/explorer/modules', async (req, reply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const userResult = await getUserSafe(authTokenId);

		if (userResult.success === false) {
			reply.status(401).send({ success: false, errors: userResult.errors });
			return;
		}

		const lang = req.query.lang ?? LANG_QUERY_DEFAULT;
		const result = getExplorerModules(userResult.data, lang);
		reply.send({ success: true, data: result });
	});

	done();
};

export default fp(explorerMetaApi);
