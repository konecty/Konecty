import { callMethod } from 'utils/methods';
import { getAuthTokenIdFromReq } from 'utils/session';

export default app => {
	// Converted to method
	app.get('/api/v1/comment/:document/:dataId', async (req, res) => {
		const result = await callMethod('comments:find', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
		});
		res.send(result);
	});

	// Converted to method
	app.post('/api/v1/comment/:document/:dataId', async (req, res) => {
		const result = await callMethod('comments:create', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			text: req.body.text,
			dataId: req.params.dataId,
		});
		res.send(result);
	});
};
