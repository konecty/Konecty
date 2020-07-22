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

app.post('/rest/file/upload/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName', (req, res) =>
	middlewares.sessionUserAndGetAccessFor('metaDocumentId')(req, res, async function () {
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
				const storage = getStorage({
					domain: process.env.S3_DOMAIN,
					accessKeyId: process.env.S3_ACCESSKEY,
					secretAccessKey: process.env.S3_SECRETKEY,
					region: process.env.S3_REGION,
				});

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
				await _writeFile(filePath, fileContent);
			}

			const coreResponse = Meteor.call('file:upload', {
				params: {
					document: documentId,
					fieldName: fieldName,
					recordCode: recordId,
				},
				cookies: req.cookies,
				headers: req.headers,
				body: fileData,
			});

			if (coreResponse.success === false) {
				if (/^s3$/i.test(process.env.STORAGE)) {
					await storage
						.deleteObject({
							Bucket: process.env.S3_BUCKET,
							Key: `konecty.${namespace}/${directory}/${fileName}`,
							VersionId: fileData.version,
						})
						.promise();
				} else {
					await _unlink(join(process.env.STORAGE_DIR, directory, fileData.etag));
				}
			} else if (!/^s3$/i.test(process.env.STORAGE)) {
				await _rename(join(process.env.STORAGE_DIR, directory, fileData.etag), join(process.env.STORAGE_DIR, directory, fileName));
			}
			console.log({
				success: true,
				...fileData,
				coreResponse,
				_id: coreResponse._id,
				_updatedAt: coreResponse._updatedAt,
			});
			res.send({
				success: true,
				...fileData,
				coreResponse,
				_id: coreResponse._id,
				_updatedAt: coreResponse._updatedAt,
			});
		} catch (error) {
			console.error(error);
			res.send(error);
		}
	}),
);
