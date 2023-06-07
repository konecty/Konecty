import { app } from '../../../lib/routes/app'
import { middlewares } from '../../../lib/routes/middlewares';

/* @Add_File */
app.post('/rest/file2/:document/:recordCode/:fieldName', (req, res) =>
	middlewares.sessionUserAndGetAccessFor('document')(req, res, function () {
		const {
			headers,
			body,
			cookies,
			params: { document, recordCode, fieldName },
		} = req;
		const coreResponse = Meteor.call('file:upload', {
			params: {
				document,
				fieldName,
				recordCode,
			},
			cookies,
			headers,
			body,
		});
		res.send(coreResponse);
	}),
);

/* @Remove_File */
app.del('/rest/file2/:document/:recordCode/:fieldName/:fileName', (req, res) =>
	middlewares.sessionUserAndGetAccessFor('document')(req, res, function () {
		const { document, recordCode, fieldName, fileName } = req.params;

		const coreResponse = Meteor.call('file:remove', {
			params: {
				document,
				fieldName,
				recordCode,
				fileName,
			},
			cookies: req.cookies,
			headers: req.headers,
		});

		if (coreResponse.success === false) {
			return res.send(coreResponse);
		}

		res.send(coreResponse);
	}),
);
