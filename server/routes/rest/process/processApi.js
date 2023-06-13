import { Meteor } from 'meteor/meteor';

import { app } from '/server/lib/routes/app';
import { sessionUtils } from '/imports/utils/sessionUtils';

app.post('/rest/process/submit', (req, res) =>
	res.send(
		Meteor.call('process:submit', {
			authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
			data: req.body.data,
		}),
	),
);
