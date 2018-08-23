/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
app.post('/rest/process/submit', (req, res, next) =>
	res.send(Meteor.call('process:submit', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		data: req.body.data
	}
	)
	)
);

app.post('/rest/process/zapier', (req, res, next) =>
	res.send(Meteor.call('process:zapier', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		data: req.body
	}
	)
	)
);
