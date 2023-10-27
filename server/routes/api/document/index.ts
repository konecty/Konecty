import { WebApp } from 'meteor/webapp';
import { match } from 'path-to-regexp';
import { getUserFromRequest } from '/imports/auth/getUser';
import { getDocument } from '/imports/document';
import { logger } from '/imports/utils/logger';

WebApp.connectHandlers.use('/api/document', async (req, res) => {
	const matchPath = match<{ id?: string }>('/api/document/:id', { decode: decodeURIComponent });

	const urlParams = matchPath(req.originalUrl ?? '');

	if (req.originalUrl == null || urlParams === false) {
		res.writeHead(404);
		res.end('Not found');
		return;
	}

	const id = urlParams.params.id;

	if (id == null) {
		res.writeHead(400);
		res.end('Bad request');
		return;
	}

	try {
		const user = await getUserFromRequest(req);

		if (user == null) {
			res.writeHead(401);
			res.end('Unauthorized');
			return;
		}

		const result = await getDocument(id);

		if (result == null) {
			res.writeHead(400);
			res.end('Invalid meta object');
			return;
		}

		res.setHeader('Content-Type', 'application/json');
		res.writeHead(200);
		res.end(JSON.stringify(result, null, 2));
	} catch (error) {
		if (/^\[get-user\]/.test((error as Error).message)) {
			res.writeHead(401);
			res.end('Unauthorized');
			return;
		}
		logger.error(error, `Error getting document ${id}}`);
		res.writeHead(500);
		res.end('Internal server error');
	}
});
