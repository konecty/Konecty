/* @Add_File */
app.post('/rest/file2/:document/:recordCode/:fieldName', (req, res) =>
	middlewares.sessionUserAndGetAccessFor('document')(req, res, function () {
		res.send(Meteor.call('file:upload', req));
	}),
);

/* @Remove_File */
app.del('/rest/file2/:document/:recordCode/:fieldName/:fileName', (req, res) =>
	middlewares.sessionUserAndGetAccessFor('document')(req, res, function () {
		res.send(Meteor.call('file:remove', req));
	}),
);
