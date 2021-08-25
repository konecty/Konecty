import { callMethod } from 'utils/methods';

import { getAuthTokenIdFromReq } from 'utils/session';

export default app => {
	app.post('/api/v1/changeUser/:document/add', async (req, res) => {
		const result = await callMethod('changeUser:add', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		});
		res.send(result);
	});

	app.post('/api/v1/changeUser/:document/remove', async (req, res) => {
		const result = await callMethod('changeUser:remove', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		});
		res.send(result);
	});

	app.post('/api/v1/changeUser/:document/define', async (req, res) => {
		const result = await callMethod('changeUser:define', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			users: req.body.data,
		});
		res.send(result);
	});

	app.post('/api/v1/changeUser/:document/replace', async (req, res) => {
		const result = await callMethod('changeUser:replace', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			from: req.body.data.from,
			to: req.body.data.to,
		});
		res.send(result);
	});

	app.post('/api/v1/changeUser/:document/countInactive', async (req, res) => {
		const result = await callMethod('changeUser:countInactive', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
		});
		res.send(result);
	});

	app.post('/api/v1/changeUser/:document/removeInactive', async (req, res) => {
		const result = await callMethod('changeUser:removeInactive', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
		});
		res.send(result);
	});

	app.post('/api/v1/changeUser/:document/setQueue', async (req, res) => {
		const result = await callMethod('changeUser:setQueue', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			ids: req.body.ids,
			queue: req.body.data,
		});
		res.send(result);
	});
};
