import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { app } from '/server/lib/routes/app';
import { menuFull, metaDocuments, metaDocument } from '/imports/menu/legacy';

// Converted to method
app.get('/rest/menu/list', async function (req, res) {
	const result = await menuFull({ authTokenId: getAuthTokenIdFromReq(req) });
	res.send(result);
});

app.get('/rest/menu/documents', async function (req, res) {
	const result = await metaDocuments({ authTokenId: getAuthTokenIdFromReq(req) });
	res.send(result);
});

app.get('/rest/menu/documents/:document', async function (req, res) {
	const result = await metaDocument({ document: req.params.document, authTokenId: getAuthTokenIdFromReq(req) });
	res.send(result);
});
