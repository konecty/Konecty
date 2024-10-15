import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import path from 'path';

import { getUserSafe } from '@imports/auth/getUser';
import { fileRemove } from '@imports/file/file';
import { MetaObject } from '@imports/model/MetaObject';
import FileStorage from '@imports/storage/FileStorage';
import { getAccessFor } from '@imports/utils/accessUtils';
import { logger } from '@imports/utils/logger';
import { errorReturn } from '@imports/utils/return';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

const fileDeleteApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.delete<{ Params: { namespace: string; metaDocumentId: string; recordId: string; fieldName: string; fileName: string } }>(
		'/rest/file/delete/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName',
		async function (req, reply) {
			const { metaDocumentId: document, recordId, fieldName, fileName } = req.params;

			const authTokenId = getAuthTokenIdFromReq(req);

			const { success, data: user, errors } = (await getUserSafe(authTokenId)) as any;
			if (success === false) {
				return errorReturn(errors);
			}

			const access = getAccessFor(document, user);

			if (access === false || access.isReadable !== true) {
				return errorReturn(`[${document}] You don't have permission read records`);
			}

			const coreResponse = await fileRemove({
				document: document,
				fieldName: fieldName,
				recordCode: recordId,
				fileName,
				contextUser: user,
			});

			if (coreResponse.success === false) {
				logger.trace(coreResponse.errors, 'Error deleting file');
				return reply.send(coreResponse);
			}

			const directory = path.join(document, recordId, fieldName);
			const fileStorage = FileStorage.fromNamespaceStorage(MetaObject.Namespace.storage);
			await fileStorage.delete(directory, fileName);

			reply.send(coreResponse);
		},
	);

	done();
};

export default fp(fileDeleteApi);
