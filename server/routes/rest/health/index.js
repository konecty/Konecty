import { Meteor } from 'meteor/meteor';

import { MetaObject } from '/imports/model/MetaObject';

import { app } from '/server/lib/routes/app';
import { logger } from '/imports/utils/logger';

let readiness = false;

app.get('/readiness', (_, res) => {
	if (readiness) {
		res.send(200, 'OK');
	} else {
		res.send(503, 'Not ready');
	}
});

app.get('/liveness', async (_, res) => {
	if (readiness) {
		try {
			await MetaObject.findOne({ _id: 'Namespace' });
			res.send('OK');
		} catch (error) {
			logger.error(error, `Error on liveness (${new Date().toISOString()}): ${error.message}`);
			res.send(503, 'The king is dead, long live the king!');
		}
	} else {
		res.send(503, 'Not ready');
	}
});

Meteor.startup(() => {
	readiness = true;
});
