import { WebApp } from 'meteor/webapp';
import { getUserFromRequest } from '/imports/auth/getUser';
import { logger } from '/imports/utils/logger';
import { mainMenu } from '/imports/menu/main';

WebApp.connectHandlers.use('/api/menu/main', async (req, res) => {
	try {
		const user = await getUserFromRequest(req);

		if (user == null) {
			res.writeHead(401);
			res.end('Unauthorized');
			return;
		}

		const result = await mainMenu(user);

		res.setHeader('Content-Type', 'application/json');
		res.writeHead(200);
		res.end(JSON.stringify(result, null, 2));
	} catch (error) {
		if (/^\[get-user\]/.test((error as Error).message)) {
			res.writeHead(401);
			res.end('Unauthorized');
			return;
		}
		logger.error(error, 'Error getting main menu');
		res.writeHead(500);
		res.end('Internal server error');
	}
});
