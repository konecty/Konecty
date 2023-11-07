import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { unlink } from 'fs/promises';
import path from 'path';

import { MetaObject } from '@imports/model/MetaObject';
import { fileRemove } from '@imports/file/file';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { errorReturn } from '@imports/utils/return';
import { getAccessFor } from '@imports/utils/accessUtils';
import { logger } from '@imports/utils/logger';

const fileDeleteApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.delete<{ Params: { namespace: string; metaDocumentId: string; recordId: string; fieldName: string; fileName: string } }>(
		'/rest/file/delete/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName',
		async function (req, reply) {
			const { metaDocumentId: document, recordId, fieldName, fileName } = req.params;

			const namespace = MetaObject.Namespace.name;

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
			if (/^s3$/i.test(MetaObject.Namespace.storage?.type ?? 'fs')) {
				const s3 = new S3Client(MetaObject.Namespace.storage?.config ?? {});

				try {
					await s3.send(
						new DeleteObjectCommand({
							Bucket: MetaObject.Namespace.storage.bucket,
							Key: `${namespace}/${document}/${recordId}/${fieldName}/${fileName}`,
						}),
					);
				} catch (e) {
					logger.error(e, `Error deleting file ${fileName} from S3`);
				}

				try {
					await s3.send(
						new DeleteObjectCommand({
							Bucket: MetaObject.Namespace.storage.bucket,
							Key: `${namespace}/${document}/${recordId}/${fieldName}/thumbnail/${fileName}`,
						}),
					);
				} catch (e) {
					logger.error(e, `Error deleting thumbnail file ${fileName} from S3`);
				}

				if (MetaObject.Namespace.storage?.wm != null) {
					try {
						await s3.send(
							new DeleteObjectCommand({
								Bucket: MetaObject.Namespace.storage.bucket,
								Key: `${namespace}/${document}/${recordId}/${fieldName}/watermark/${fileName}`,
							}),
						);
					} catch (e) {
						logger.error(e, `Error deleting watermark file ${fileName} from S3`);
					}
				}
			} else {
				const fullPath = path.join(MetaObject.Namespace.storage?.directory ?? '/tmp', namespace, document, recordId, fieldName, decodeURIComponent(fileName));
				const thumbnailFullPath = path.join(
					MetaObject.Namespace.storage?.directory ?? '/tmp',
					namespace,
					document,
					recordId,
					fieldName,
					'thumbnail',
					decodeURIComponent(fileName),
				);
				const watermarkFullPath = path.join(
					MetaObject.Namespace.storage?.directory ?? '/tmp',
					namespace,
					document,
					recordId,
					fieldName,
					'watermark',
					decodeURIComponent(fileName),
				);
				try {
					unlink(fullPath);
				} catch (error) {
					logger.error(error, `Error deleting file ${fileName} from FS`);
				}

				try {
					unlink(thumbnailFullPath);
				} catch (error) {
					logger.error(error, `Error deleting thumbnail file ${fileName} from FS`);
				}

				if (MetaObject.Namespace.storage?.wm != null) {
					try {
						unlink(watermarkFullPath);
					} catch (error) {
						logger.error(error, `Error deleting watermark file ${fileName} from FS`);
					}
				}
			}
			reply.send(coreResponse);
		},
	);

	done();
};

export default fp(fileDeleteApi);
