import { Meteor } from 'meteor/meteor';

import { app } from '/server/lib/routes/app';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';

app.post('/rest/changeUser/:document/add', (req, res) =>
	res.send(
		Meteor.call('changeUser:add', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		}),
	),
);

app.post('/rest/changeUser/:document/remove', (req, res) =>
	res.send(
		Meteor.call('changeUser:remove', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		}),
	),
);

app.post('/rest/changeUser/:document/define', (req, res) =>
	res.send(
		Meteor.call('changeUser:define', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		}),
	),
);

app.post('/rest/changeUser/:document/replace', (req, res) =>
	res.send(
		Meteor.call('changeUser:replace', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			from: req.body.data.from,
			to: req.body.data.to,
		}),
	),
);

app.post('/rest/changeUser/:document/countInactive', (req, res) =>
	res.send(
		Meteor.call('changeUser:countInactive', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
		}),
	),
);

app.post('/rest/changeUser/:document/removeInactive', (req, res) =>
	res.send(
		Meteor.call('changeUser:removeInactive', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
		}),
	),
);

app.post('/rest/changeUser/:document/setQueue', (req, res) =>
	res.send(
		Meteor.call('changeUser:setQueue', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			queue: req.body.data,
		}),
	),
);
