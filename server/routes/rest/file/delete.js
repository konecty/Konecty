import { unlink } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import getStorage from './getStorage';

import { app } from '/server/lib/routes/app';
import { middlewares } from '/server/lib/routes/middlewares';

const _unlink = promisify(unlink);

app.del('/rest/file/delete/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName', (req, res) =>
	middlewares.sessionUserAndGetAccessFor('metaDocumentId')(req, res, async function () {
		try {
			const { namespace, metaDocumentId, recordId, fieldName, fileName } = req.params;

			const coreResponse = Meteor.call('file:remove', {
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
