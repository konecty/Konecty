import { writeFile, rename, unlink, stat as _stat } from 'fs';
import { join, dirname } from 'path';
import { promisify } from 'util';
import mkdirp from 'mkdirp';
import { createHash } from 'crypto';
import sharp from 'sharp';

import getStorage from './getStorage';
import getFile from './getFile';
import detectContentType from './detectContentType';

const _writeFile = promisify(writeFile);
const _unlink = promisify(unlink);
const _rename = promisify(rename);
const computeHash = buffer => createHash('md5').update(buffer).digest('hex');

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
				const storage = getStorage({
					domain: process.env.S3_DOMAIN,
					accessKeyId: process.env.S3_ACCESSKEY,
					secretAccessKey: process.env.S3_SECRETKEY,
					region: process.env.S3_REGION,
				});

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
