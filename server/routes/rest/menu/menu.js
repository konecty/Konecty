/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Converted to method
app.get('/rest/menu/list', (req, res, next) =>
	res.send(Meteor.call('menu',
		{authTokenId: sessionUtils.getAuthTokenIdFromReq(req)})
	)
);
