import { Meteor } from 'meteor/meteor';

import { app } from '/server/lib/routes/app';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';

app.post('/rest/process/submit', (req, res) =>
	res.send(
		Meteor.call('process:submit', {
			authTokenId: getAuthTokenIdFromReq(req),
			data: req.body.data,
		}),
	),
);
