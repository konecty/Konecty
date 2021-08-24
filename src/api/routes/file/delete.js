import { unlink } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import { callMethod } from 'utils/methods';

import getStorage from './getStorage';

import { sessionUserAndGetAccessFor } from '../../app/middlewares';

const _unlink = promisify(unlink);

const init = app => {
	app.del('/rest/file/delete/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName', async (req, res) =>
		sessionUserAndGetAccessFor('metaDocumentId')(req, res, async function () {
			try {
				const { namespace, metaDocumentId, recordId, fieldName, fileName } = req.params;

				const coreResponse = await callMethod('file:remove', {
					params: {
						document: metaDocumentId,
						fieldName: fieldName,
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
					await _unlink(join(process.env.STORAGE_DIR, metaDocumentId, recordId, fieldName, fileName));
				}
				res.send(coreResponse);
			} catch (error) {
				console.error(error);
				res.send(error);
			}
		}),
	);
};

export { init };
