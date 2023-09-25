import { writeFile, rename, unlink } from 'fs/promises';
import { join } from 'path';
import { mkdirp } from 'mkdirp';
import { createHash } from 'crypto';
import sharp from 'sharp';

import getStorage from './getStorage';
import getFile from './getFile';
import detectContentType from './detectContentType';

import { app } from '/server/lib/routes/app';
import { logger } from '/imports/utils/logger';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { errorReturn } from '/imports/utils/return';
import { getUserSafe } from '/imports/auth/getUser';
import { getAccessFor, getFieldPermissions } from '/imports/utils/accessUtils';
import { fileUpload } from '/imports/file/file';

const computeHash = buffer => createHash('md5').update(buffer).digest('hex');

app.post('/rest/file/upload/:namespace/:accessId/:document/:recordId/:fieldName', async function (req, res) {
	try {
		const authTokenId = getAuthTokenIdFromReq(req);
		const { success, data: user, errors } = await getUserSafe(authTokenId);
		if (success === false) {
			return errorReturn(errors);
		}
		const { namespace, document, recordId, fieldName } = req.params;

		const access = getAccessFor(document, user);

		if (access === false || access.isUpdatable !== true) {
			return errorReturn(`[${document}] You don't have permission to upload files`);
		}

		const { fileContent, fileName } = await getFile(req);

		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isUpdatable !== true) {
			return errorReturn(`[${document}] You don't have permission to update field ${fieldName}`);
		}

		const directory = `${document}/${recordId}/${fieldName}`;

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

		const key = `${directory}/${fileName}`; // .split('/').map(encodeURIComponent).join('/');

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

		const coreResponse = await fileUpload({
			params: {
				document: document,
				fieldName: fieldName,
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
			_id: coreResponse._id,
			_updatedAt: coreResponse._updatedAt,
		});
	} catch (error) {
		logger.error(error, `Error uploading file ${req.params.fileName}: ${error.message}`);
		res.send(error);
	}
});
