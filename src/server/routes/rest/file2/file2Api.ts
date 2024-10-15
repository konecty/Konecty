import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { fileRemove, fileUpload } from '@imports/file/file';

import { getUserSafe } from '@imports/auth/getUser';
import { getAccessFor, getFieldPermissions } from '@imports/utils/accessUtils';
import { errorReturn } from '@imports/utils/return';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

const file2Api: FastifyPluginCallback = (fastify, _, done) => {
	fastify.post<{
		Params: {
			document: string;
			recordCode: string;
			fieldName: string;
		};
	}>('/rest/file2/:document/:recordCode/:fieldName/', async function (req, reply) {
		const authTokenId = getAuthTokenIdFromReq(req);
		const { success, data: user, errors } = (await getUserSafe(authTokenId)) as any;
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

		const { body } = req;

		const coreResponse = await fileUpload({
			document,
			fieldName,
			recordCode,
			body: body as object,
			contextUser: user,
		});
		reply.send(coreResponse);
	});

	fastify.delete<{
		Params: {
			document: string;
			recordCode: string;
			fieldName: string;
			fileName: string;
		};
	}>('/rest/file2/:document/:recordCode/:fieldName/:fileName', async function (req, reply) {
		const { document, recordCode, fieldName, fileName } = req.params;
		const authTokenId = getAuthTokenIdFromReq(req);
		const { success, data: user, errors } = (await getUserSafe(authTokenId)) as any;
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
			document,
			fieldName,
			recordCode,
			fileName,
			contextUser: user,
		});

		if (coreResponse.success === false) {
			return reply.send(coreResponse);
		}

		reply.send(coreResponse);
	});

	done();
};

export default fp(file2Api);
