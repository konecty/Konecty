import { app } from '/server/lib/routes/app';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { processSubmit } from '/imports/data/process';

app.post('/rest/process/submit', async function (req, res) {
	const result = await processSubmit({
		authTokenId: getAuthTokenIdFromReq(req),
		data: req.body.data,
	});

	res.send(result);
});
