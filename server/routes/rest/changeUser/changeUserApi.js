import { app } from '/server/lib/routes/app';
import { addUser, countInactive, defineUser, removeUser, replaceUser, removeInactive, setQueue } from '/imports/data/changeUser';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';

app.post('/rest/changeUser/:document/add', async (req, res) => {
	const result = await addUser({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		ids: req.body.ids,
		users: req.body.data,
	});

	res.send(result);
});

app.post('/rest/changeUser/:document/remove', async (req, res) => {
	const result = await removeUser({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		ids: req.body.ids,
		users: req.body.data,
	});

	res.send(result);
});

app.post('/rest/changeUser/:document/define', async (req, res) => {
	const result = await defineUser({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		ids: req.body.ids,
		users: req.body.data,
	});

	res.send(result);
});

app.post('/rest/changeUser/:document/replace', async (req, res) => {
	const result = await replaceUser({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		ids: req.body.ids,
		from: req?.body?.data?.from,
		to: req?.body?.data?.to,
	});

	res.send(result);
});

app.post('/rest/changeUser/:document/countInactive', async (req, res) => {
	const result = await countInactive({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		ids: req.body.ids,
	});

	res.send(result);
});

app.post('/rest/changeUser/:document/removeInactive', async (req, res) => {
	const result = await removeInactive({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		ids: req.body.ids,
	});

	res.send(result);
});

app.post('/rest/changeUser/:document/setQueue', async (req, res) => {
	const result = await setQueue({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		ids: req.body.ids,
		queue: req.body.data,
	});

	res.send(result);
});
