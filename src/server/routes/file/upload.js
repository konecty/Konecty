import { writeFile, rename, unlink } from 'fs/promises';
import { join } from 'path';
import mkdirp from 'mkdirp';
import { createHash } from 'crypto';
import sharp from 'sharp';

import { callMethod } from 'utils/methods';
import logger from 'utils/logger';

import getStorage from './getStorage';
import getFile from './getFile';
import detectContentType from './detectContentType';

import { sessionUserAndGetAccessFor } from '../../app/middlewares';

const computeHash = buffer => createHash('md5').update(buffer).digest('hex');

export default app => {
	app.post('/api/v1/file/upload/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName', (req, res) =>
		sessionUserAndGetAccessFor('metaDocumentId')(req, res, async () => {
			try {
				const { fileContent, fileName } = await getFile(req);
				const { namespace, metaDocumentId: documentId, recordId, fieldName } = req.params;

				const directory = `${documentId}/${recordId}/${fieldName}`;

				const contentType = await detectContentType(fileContent);

				let content = fileContent;
				if (/^image\/jpeg$/.test(contentType)) {
					const image = sharp(fileContent);
					const { width, height } = await image.metadata();

					if (width > 3840 || height > 3840) {
						content = await image
							.resize({
								width: 3840,
								height: 3840,
								fit: 'inside',
							})
							.toBuffer();
					}
				}

				const key = `${directory}/${fileName}`.split('/').map(encodeURIComponent).join('/');

				const fileData = {
					key,
					kind: contentType,
					size: content.length,
					name: fileName,
				};

				if (/^s3$/i.test(process.env.STORAGE)) {
					const storage = getStorage();

					const { ETag, VersionId } = await storage
						.putObject({
							Bucket: process.env.S3_BUCKET,
							Key: `konecty.${namespace}/${directory}/${fileName}`,
							ContentType: contentType,
							Body: content,
						})
						.promise();

					fileData.etag = ETag;
					fileData.version = VersionId;
				} else {
					fileData.etag = computeHash(fileContent);
					const filePath = join(process.env.STORAGE_DIR, directory, fileData.etag);
					await mkdirp(join(process.env.STORAGE_DIR, directory));
					await writeFile(filePath, fileContent);
				}

				const coreResponse = await callMethod('file:upload', {
					params: {
						document: documentId,
						fieldName,
						recordCode: recordId,
					},
					cookies: req.cookies,
					headers: req.headers,
					body: fileData,
				});

				if (coreResponse.success === false) {
					if (/^s3$/i.test(process.env.STORAGE)) {
						const storage = getStorage();
						await storage
							.deleteObject({
								Bucket: process.env.S3_BUCKET,
								Key: `konecty.${namespace}/${directory}/${fileName}`,
								VersionId: fileData.version,
							})
							.promise();
					} else {
						await unlink(join(process.env.STORAGE_DIR, directory, fileData.etag));
					}
				} else if (!/^s3$/i.test(process.env.STORAGE)) {
					await rename(join(process.env.STORAGE_DIR, directory, fileData.etag), join(process.env.STORAGE_DIR, directory, fileName));
				}

				res.send({
					success: true,
					...fileData,
					coreResponse,
					// eslint-disable-next-line no-underscore-dangle
					_id: coreResponse._id,
					// eslint-disable-next-line no-underscore-dangle
					_updatedAt: coreResponse._updatedAt,
				});
			} catch (error) {
				logger.error(error, 'Error uploading file');
				res.send(error);
			}
		}),
	);
};
