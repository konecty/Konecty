import { Meteor } from 'meteor/meteor';

import { app } from '/server/lib/routes/app';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';

// Converted to method
app.get('/rest/comment/:document/:dataId', (req, res) =>
	res.send(
		Meteor.call('comments:find', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
		}),
	),
);

// Converted to method
app.post('/rest/comment/:document/:dataId', (req, res) =>
	res.send(
		Meteor.call('comments:create', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			text: req.body.text,
			dataId: req.params.dataId,
		}),
	),
);
