import { app } from '/server/lib/routes/app';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { findComments, createComment } from '/imports/data/comments';

// Converted to method
app.get('/rest/comment/:document/:dataId', async (req, res) => {
	const result = await findComments({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		dataId: req.params.dataId,
	});

	res.send(result);
});

// Converted to method
app.post('/rest/comment/:document/:dataId', async (req, res) => {
	const result = await createComment({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		dataId: req.params.dataId,
		text: req.body.text,
	});

	res.send(result);
});
