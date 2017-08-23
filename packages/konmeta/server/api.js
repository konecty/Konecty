import { WebApp } from 'meteor/webapp';
import loadSchemaFromExternalDB from './lib/loadSchemaFromExternalDB';

WebApp.connectHandlers.use('/konmeta/update', async (req, res, next) => {
	const secretSent = req.headers['x-konmeta-secret'] || '';

	if (!process.env.KONMETA_DB_URL || !process.env.KONMETA_UPDATE_SECRET || process.env.KONMETA_UPDATE_SECRET !== secretSent) {
		res.writeHead(403);
		return res.end();
	}

	loadSchemaFromExternalDB();

	res.writeHead(200);
	res.end(`Hello world from: ${Meteor.release}`);
});
