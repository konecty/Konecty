import { FastifyPluginCallback, RouteHandler } from 'fastify';
import fp from 'fastify-plugin';

import path from 'path';

import Multipart from '@fastify/multipart';
import sharp from 'sharp';

import { getUserSafe } from '@imports/auth/getUser';
import { DEFAULT_JPEG_MAX_SIZE, DEFAULT_JPEG_QUALITY, DEFAULT_THUMBNAIL_SIZE, FILE_UPLOAD_MAX_FILE_SIZE } from '@imports/consts';
import { MetaObject } from '@imports/model/MetaObject';
import FileStorage, { FileData } from '@imports/storage/FileStorage';
import { getAccessFor, getFieldPermissions } from '@imports/utils/accessUtils';
import { logger } from '@imports/utils/logger';
import { errorReturn } from '@imports/utils/return';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { sanitizeFilename } from './sanitize';
import { applyWatermark } from './watermark';

type RouteParams = {
	Params: {
		namespace: string;
		accessId: string;
		document: string;
		recordId: string;
		fieldName: string;
		fileName: string;
	};
};

const fileUploadApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.register(Multipart, {
		limits: {
			fileSize: MetaObject.Namespace.storage?.maxFileSize ?? FILE_UPLOAD_MAX_FILE_SIZE,
		},
	});

	fastify.post('/rest/file/upload/:namespace/:accessId/:document/:recordId/:fieldName', uploadRoute);
	fastify.post('/rest/file/upload/:accessId/:document/:recordId/:fieldName', uploadRoute);

	done();
};

const uploadRoute: RouteHandler<RouteParams> = async (req, reply) => {
	try {
		const authTokenId = getAuthTokenIdFromReq(req);
		const { success, data: user, errors } = (await getUserSafe(authTokenId)) as any;
		if (success === false) {
			return errorReturn(errors);
		}
		const { document, recordId, fieldName, accessId } = req.params;

		const namespace = MetaObject.Namespace.ns;

		logger.trace({ namespace, document, recordId, fieldName }, 'fileUploadApi');

		const access = getAccessFor(document, user);

		if (access === false || access.isUpdatable !== true) {
			return errorReturn(`[${document}] You don't have permission to upload files`);
		}

		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isUpdatable !== true) {
			return errorReturn(`[${document}] You don't have permission to update field ${fieldName}`);
		}

		const data = await req.file();

		if (data == null) {
			return errorReturn(`[${document}] No file sent`);
		}

		const contentType = data.mimetype;
		const fileName = encodeURIComponent(sanitizeFilename(decodeURIComponent(data.filename)));

		let fileContent = await data.toBuffer();

		if (data.encoding !== '7bit') {
			fileContent = Buffer.from(fileContent.toString('utf8'), data.encoding as BufferEncoding);
		}

		logger.trace({ contentType, fileName }, `Uploading file ${fileName}`);

		const directory = `${document}/${recordId}/${fieldName}`;

		const filesToSave: Array<{
			name: string;
			content: Buffer;
		}> = [];

		if (/^image\/jpeg$/.test(contentType)) {
			logger.trace({ contentType, fileName }, `Resizing image ${fileName}`);
			const image = sharp(fileContent);
			const { width = 0, height = 0 } = await image.metadata();

			const maxWidth = MetaObject.Namespace.storage?.jpeg?.maxWidth ?? DEFAULT_JPEG_MAX_SIZE;
			const maxHeight = MetaObject.Namespace.storage?.jpeg?.maxHeight ?? DEFAULT_JPEG_MAX_SIZE;

			if (width > maxWidth || height > maxHeight) {
				const resizedImageBuffer = await image
					.resize({
						width: 3840,
						height: 3840,
						fit: 'inside',
					})
					.jpeg({
						quality: MetaObject.Namespace.storage?.jpeg?.quality ?? DEFAULT_JPEG_QUALITY,
						force: true,
					})
					.toBuffer();
				filesToSave.push({
					name: fileName,
					content: resizedImageBuffer,
				});
			} else {
				const imageBuffer = await image
					.jpeg({
						quality: MetaObject.Namespace.storage?.jpeg?.quality ?? DEFAULT_JPEG_QUALITY,
						force: true,
					})
					.toBuffer();
				filesToSave.push({
					name: fileName,
					content: imageBuffer,
				});
			}

			const thumbnailImageBuffer = await image
				.clone()
				.resize({
					width: MetaObject.Namespace.storage?.thumbnail?.size ?? DEFAULT_THUMBNAIL_SIZE,
					height: MetaObject.Namespace.storage?.thumbnail?.size ?? DEFAULT_THUMBNAIL_SIZE,
					fit: 'cover',
				})
				.jpeg({
					quality: MetaObject.Namespace.storage?.jpeg?.quality ?? DEFAULT_JPEG_QUALITY,
					force: true,
				})
				.toBuffer();

			filesToSave.push({
				name: path.join('thumbnail', fileName),
				content: thumbnailImageBuffer,
			});

			if (MetaObject.Namespace.storage?.wm != null) {
				const watermarkImageResult = await applyWatermark(image);
				if (watermarkImageResult.success === false) {
					return reply.send(watermarkImageResult);
				}

				filesToSave.push({
					name: path.join('watermark', fileName),
					content: watermarkImageResult.data,
				});
			}
		} else {
			filesToSave.push({
				name: fileName,
				content: fileContent,
			});

			const fileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1024">
<g><rect x="0" y="0" width="720" height="1024" fill="#cccccc"></rect></g>
<g><path fill="#ffffff" transform="translate(40, 150)" d="M320 400c-75.85 0-137.25-58.71-142.9-133.11L72.2 185.82c-13.79 17.3-26.48 35.59-36.72 55.59a32.35 32.35 0 0 0 0 29.19C89.71 376.41 197.07 448 320 448c26.91 0 52.87-4 77.89-10.46L346 397.39a144.13 144.13 0 0 1-26 2.61zm313.82 58.1l-110.55-85.44a331.25 331.25 0 0 0 81.25-102.07 32.35 32.35 0 0 0 0-29.19C550.29 135.59 442.93 64 320 64a308.15 308.15 0 0 0-147.32 37.7L45.46 3.37A16 16 0 0 0 23 6.18L3.37 31.45A16 16 0 0 0 6.18 53.9l588.36 454.73a16 16 0 0 0 22.46-2.81l19.64-25.27a16 16 0 0 0-2.82-22.45zm-183.72-142l-39.3-30.38A94.75 94.75 0 0 0 416 256a94.76 94.76 0 0 0-121.31-92.21A47.65 47.65 0 0 1 304 192a46.64 46.64 0 0 1-1.54 10l-73.61-56.89A142.31 142.31 0 0 1 320 112a143.92 143.92 0 0 1 144 144c0 21.63-5.29 41.79-13.9 60.11z"></path></g>
<g><text x="256" y="900" text-anchor="middle" alignment-baseline="top" font-family="Verdana" font-size="80" fill="#ffffff">${fileName}</text></g>
</svg>`;

			const fileIconBuffer = await sharp(Buffer.from(fileSvg))
				.resize({
					width: MetaObject.Namespace.storage?.thumbnail?.size ?? DEFAULT_THUMBNAIL_SIZE,
					height: MetaObject.Namespace.storage?.thumbnail?.size ?? DEFAULT_THUMBNAIL_SIZE,
					fit: sharp.fit.contain,
					position: sharp.gravity.center,
					background: '#cccccc',
				})
				.jpeg({ quality: MetaObject.Namespace.storage?.jpeg?.quality ?? DEFAULT_JPEG_QUALITY, force: true })
				.toBuffer();

			filesToSave.push({
				name: path.join('thumbnail', `${path.basename(fileName)}.jpeg`),

				content: fileIconBuffer,
			});
		}

		const key = `${directory}/${fileName}`;

		const fileData: FileData = {
			key,
			kind: contentType,
			size: filesToSave[0].content.length,
			name: fileName,
		};

		const fileContext = { namespace, document, recordId, fieldName, user, fileName, accessId, authTokenId, headers: req.headers };

		const fileStorage = FileStorage.fromNamespaceStorage(MetaObject.Namespace.storage);
		const coreResponse = await fileStorage.upload(fileData, filesToSave, fileContext);

		reply.send({
			success: true,
			...fileData,
			coreResponse,
			_id: coreResponse._id,
			_updatedAt: coreResponse._updatedAt,
		});
	} catch (error) {
		logger.error(error, `Error uploading file: ${(error as Error).message}`);
		reply.send(error);
	}
};

export default fp(fileUploadApi);
