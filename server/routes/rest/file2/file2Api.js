import { app } from '../../../lib/routes/app';
import { fileRemove, fileUpload } from '/imports/file/file';

import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { errorReturn } from '/imports/utils/return';
import { getUserSafe } from '/imports/auth/getUser';
import { getAccessFor, getFieldPermissions } from '/imports/utils/accessUtils';


/* @Add_File */
app.post('/rest/file2/:document/:recordCode/:fieldName', async function (req, res) {
	const authTokenId = getAuthTokenIdFromReq(req);
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return errorReturn(errors);
	}
	const { document, fieldName, recordCode } = req.params;

	const access = getAccessFor(document, user);

	if (access === false || access.isUpdatable !== true) {
		return errorReturn(`[${document}] You don't have permission to upload files`);
	}

	const accessField = getFieldPermissions(access, fieldName);
	if (accessField.isUpdatable !== true) {
		return errorReturn(`[${document}] You don't have permission to update field ${fieldName}`);
	}

	const {
		headers,
		body,
		cookies,
	} = req;
	const coreResponse = await fileUpload({
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
});

/* @Remove_File */
app.del('/rest/file2/:document/:recordCode/:fieldName/:fileName', async function (req, res) {
	const { document, recordCode, fieldName, fileName } = req.params;
	const authTokenId = getAuthTokenIdFromReq(req);
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);

	if (access === false || access.isUpdatable !== true) {
		return errorReturn(`[${document}] You don't have permission to upload files`);
	}

	const accessField = getFieldPermissions(access, fieldName);
	if (accessField.isUpdatable !== true) {
		return errorReturn(`[${document}] You don't have permission to update field ${fieldName}`);
	}

	const coreResponse = await fileRemove({
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
});
