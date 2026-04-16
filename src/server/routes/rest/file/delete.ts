import { FastifyPluginCallback, RouteHandler } from 'fastify';
import fp from 'fastify-plugin';

import { getUserSafe } from '@imports/auth/getUser';
import type { User } from '@imports/model/User';
import type { KonectyResult } from '@imports/types/result';
import { fileRemove } from '@imports/file/file';
import { resolveStorageBasenameForDelete } from '@imports/file/resolveStorageBasenameForDelete';
import { MetaObject } from '@imports/model/MetaObject';
import FileStorage from '@imports/storage/FileStorage';
import { getAccessFor } from '@imports/utils/accessUtils';
import { logger } from '@imports/utils/logger';
import { errorReturn } from '@imports/utils/return';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

type RouteParams = { Params: { namespace: string; metaDocumentId: string; recordId: string; fieldName: string; fileName: string; accessId?: string } };

const fileDeleteApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.delete('/rest/file/delete/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName', deleteRoute);
	fastify.delete('/rest/file/delete/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName', deleteRoute);
	fastify.delete('/rest/file/delete/:metaDocumentId/:recordId/:fieldName/:fileName', deleteRoute);

	done();
};

const deleteRoute: RouteHandler<RouteParams> = async (req, reply) => {
	const { metaDocumentId: document, recordId, fieldName, fileName, accessId } = req.params;

	const authTokenId = getAuthTokenIdFromReq(req);

	const authResult: KonectyResult<User> = await getUserSafe(authTokenId);
	if (authResult.success === false) {
		return errorReturn(authResult.errors);
	}
	const user = authResult.data;

	const access = getAccessFor(document, user);

	if (access === false || access.isReadable !== true) {
		return errorReturn(`[${document}] You don't have permission read records`);
	}

	const { directory: storageDirectory, basename: storageBasename } = await resolveStorageBasenameForDelete({
		document,
		recordId,
		fieldName,
		fileNameParam: fileName,
	});

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

	const fileContext = { document, recordId, fieldName, user, fileName, accessId, authTokenId, headers: req.headers };

	const fileStorage = FileStorage.fromNamespaceStorage(MetaObject.Namespace.storage);
	await fileStorage.delete(storageDirectory, storageBasename, fileContext);

	reply.send(coreResponse);
};

export default fp(fileDeleteApi);
