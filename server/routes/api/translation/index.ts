import { get } from 'lodash';
import { WebApp } from 'meteor/webapp';
import path from 'path';
import { match } from 'path-to-regexp';
import { buildI18N } from '/imports/lib/buildI18N';
import { getUserFromRequest } from '/imports/auth/getUser';
import { logger } from '/imports/utils/logger';

WebApp.connectHandlers.use('/api/translation', async (req, res) => {
	const matchPath = match<{ lang: string }>('/api/translation/:lang', { decode: decodeURIComponent });

	if (matchPath(req.originalUrl ?? '') === false) {
		res.writeHead(404);
		res.end('Not found');
		return;
	}
	const file = get(matchPath(req.originalUrl ?? ''), 'params.lang', 'en.json');

	const lang = path.basename(file, '.json');

	try {
		const user = await getUserFromRequest(req);

		if (user == null) {
			res.writeHead(401);
			res.end('Unauthorized');
			return;
		}

		const translations = await buildI18N(user);

		const translation = get(translations, lang);

		if (translation == null) {
			res.writeHead(404);
			res.end('Not found');
			return;
		}

		res.setHeader('Content-Type', 'application/json');
		res.writeHead(200);
		res.end(JSON.stringify(translation, null, 2));
	} catch (error) {
		if (/^\[get-user\]/.test((error as Error).message)) {
			res.writeHead(401);
			res.end('Unauthorized');
			return;
		}
		logger.error(error, `Error getting translation for ${lang}`);
		res.writeHead(500);
		res.end('Internal server error');
	}
});
