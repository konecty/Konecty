import { callMethod } from 'utils/methods';
import { getAuthTokenIdFromReq } from 'utils/session';

export default app => {
	// Converted to method
	app.get('/rest/menu/list', async (req, res) => {
		const result = await callMethod('menu', { authTokenId: getAuthTokenIdFromReq(req) });
		res.send(result);
	});

	app.get('/rest/menu/documents', async (req, res) => {
		const result = await callMethod('documents', { authTokenId: getAuthTokenIdFromReq(req) });
		res.send(result);
	});

	app.get('/rest/menu/documents/:document', async (req, res) => {
		const result = await callMethod('document', { document: req.params.document, authTokenId: getAuthTokenIdFromReq(req) });
		res.send(result);
	});
};
