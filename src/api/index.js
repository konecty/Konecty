import http from 'http';
import colors from 'colors';

import { init as databaseInit } from 'database';
import { init as metadataInit } from 'metadata';
import { init as noderedInit } from 'nodered';

import { init as appInit, app } from './app';
import { init as methodsInit } from './methods';
import { init as routesInit } from './routes';

(async () => {
	colors.enable();
	const startTime = process.hrtime();

	await databaseInit();
	await metadataInit();

	appInit();

	const server = http.createServer(app.rawApp);

	if (/true|1|enable/i.test(process.env.NR_ENABLE)) {
		await noderedInit(server, app.rawApp);
	}

	await methodsInit();
	await routesInit(app);

	server.listen(process.env.PORT || 3000, () => {
		const totalTime = process.hrtime(startTime);
		console.info(`Konecty server started in ${totalTime[0]}s ${totalTime[1] / 1000000}ms`.green);
	});
})();
