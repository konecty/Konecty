import { MetaObjectCollection } from '/imports/model/MetaObject';

import { app } from '/server/lib/routes/app';
import { logger } from '/imports/utils/logger';

app.get('/readiness', (_, res) => {
	res.send(200, 'OK');
});

app.get('/liveness', async (_, res) => {
	try {
		await MetaObjectCollection.findOne({ _id: 'Namespace' });
		res.send('OK');
	} catch (error) {
		logger.error(error, `Error on liveness (${new Date().toISOString()}): ${error.message}`);
		res.send(503, 'The king is dead, long live the king!');
	}
});
