import { callMethod } from 'utils/methods';

import { getAuthTokenIdFromReq } from 'utils/session';

const init = app => {
	app.post('/rest/process/submit', async (req, res) => {
		const result = await callMethod('process:submit', {
			authTokenId: getAuthTokenIdFromReq(req),
			data: req.body.data,
		});
		res.send(result);
	});
};

export { init };
