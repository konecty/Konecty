import { Meteor } from 'meteor/meteor';

import { sessionUtils } from '/imports/utils/sessionUtils';
import { app } from '/server/lib/routes/app';


// Converted to method
app.get('/rest/menu/list', (req, res, next) =>
	res.send(Meteor.call('menu', { authTokenId: sessionUtils.getAuthTokenIdFromReq(req) }))
);

app.get('/rest/menu/documents', (req, res, next) =>
	res.send(Meteor.call('documents', { authTokenId: sessionUtils.getAuthTokenIdFromReq(req) }))
);

app.get('/rest/menu/documents/:document', (req, res, next) =>
	res.send(Meteor.call('document', { document: req.params.document, authTokenId: sessionUtils.getAuthTokenIdFromReq(req) }))
);
