import { Meteor } from 'meteor/meteor';

import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { app } from '/server/lib/routes/app';

// Converted to method
app.get('/rest/menu/list', (req, res) => res.send(Meteor.call('menu', { authTokenId: getAuthTokenIdFromReq(req) })));

app.get('/rest/menu/documents', (req, res) => res.send(Meteor.call('documents', { authTokenId: getAuthTokenIdFromReq(req) })));

app.get('/rest/menu/documents/:document', (req, res) => res.send(Meteor.call('document', { document: req.params.document, authTokenId: getAuthTokenIdFromReq(req) })));
