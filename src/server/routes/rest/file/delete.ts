import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { unlink } from 'fs/promises';
import { join } from 'path';

import getStorage from './getStorage';

import { fileRemove } from '@imports/file/file';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { errorReturn } from '@imports/utils/return';
import { getAccessFor } from '@imports/utils/accessUtils';

const fileDeleteApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.delete<{ Params: { namespace: string; metaDocumentId: string; recordId: string; fieldName: string; fileName: string } }>(
		'/rest/file/delete/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName',
		async function (req, reply) {
			const { namespace, metaDocumentId: document, recordId, fieldName, fileName } = req.params;

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
				params: {
					document: document,
					fieldName: fieldName,
					recordCode: recordId,
					fileName,
				},
				cookies: req.headers.cookie,
				headers: req.headers,
			});

			if (coreResponse.success === false) {
				return reply.send(coreResponse);
			}
			if (/^s3$/i.test(process.env.STORAGE ?? 'fs')) {
				const storage = getStorage();

				await storage
					.deleteObject({
						Bucket: process.env.S3_BUCKET ?? 'konecty',
						Key: `konecty.${namespace}/${document}/${recordId}/${fieldName}/${fileName}`,
					})
					.promise();
			} else {
				await unlink(join(process.env.STORAGE_DIR ?? '/tmp', document, recordId, fieldName, decodeURIComponent(fileName)));
			}
			reply.send(coreResponse);
		},
	);

	done();
};

export default fp(fileDeleteApi);
