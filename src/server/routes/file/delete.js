import { unlink } from 'fs/promises';
import { join } from 'path';

import { callMethod } from 'utils/methods';
import { sessionUserAndGetAccessFor } from 'server/app/middlewares';
import logger from 'utils/logger';

import getStorage from './getStorage';

export default app => {
	app.del('/api/v1/file/delete/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName', async (req, res) =>
		sessionUserAndGetAccessFor('metaDocumentId')(req, res, async () => {
			try {
				const { namespace, metaDocumentId, recordId, fieldName, fileName } = req.params;

				const coreResponse = await callMethod('file:remove', {
					params: {
						document: metaDocumentId,
						fieldName,
						recordCode: recordId,
						fileName,
					},
					cookies: req.cookies,
					headers: req.headers,
				});

				if (coreResponse.success === false) {
					return res.send(coreResponse);
				}
				if (/^s3$/i.test(process.env.STORAGE)) {
					const storage = getStorage();

					await storage
						.deleteObject({
							Bucket: process.env.S3_BUCKET,
							Key: `konecty.${namespace}/${metaDocumentId}/${recordId}/${fieldName}/${fileName}`,
						})
						.promise();
				} else {
					await unlink(join(process.env.STORAGE_DIR, metaDocumentId, recordId, fieldName, fileName));
				}
				return res.send(coreResponse);
			} catch (error) {
				logger.error(error, `Error deleting file`);
				return res.send(error);
			}
		}),
	);
};
