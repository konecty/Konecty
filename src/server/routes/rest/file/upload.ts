import { FastifyPluginCallback, RouteHandler } from 'fastify';
import fp from 'fastify-plugin';

import Multipart from '@fastify/multipart';
import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';

import { getUserSafe } from '@imports/auth/getUser';
import { DEFAULT_JPEG_MAX_SIZE, DEFAULT_JPEG_QUALITY, DEFAULT_THUMBNAIL_SIZE, FILE_UPLOAD_MAX_FILE_SIZE } from '@imports/consts';
import { MetaObject } from '@imports/model/MetaObject';
import { StorageImageSizeCfg } from '@imports/model/Namespace/Storage';
import FileStorage, { FileData } from '@imports/storage/FileStorage';
import { getAccessFor, getFieldPermissions } from '@imports/utils/accessUtils';
import getMissingParams from '@imports/utils/getMissingParams';
import { logger } from '@imports/utils/logger';
import { errorReturn } from '@imports/utils/return';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import generateFileThumbnailSvg from '@private/templates/fileThumbnail.js';
import Bluebird from 'bluebird';
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
	fastify.post('/rest/file/upload/:document/:recordId/:fieldName', uploadRoute);

	done();
};

const THUMBNAIL_CONFIG: StorageImageSizeCfg = {
	width: MetaObject.Namespace.storage?.thumbnail?.size ?? DEFAULT_THUMBNAIL_SIZE,
	height: MetaObject.Namespace.storage?.thumbnail?.size ?? DEFAULT_THUMBNAIL_SIZE,
	wm: false,
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

		const field = MetaObject.Meta[document].fields[fieldName];
		const data = await req.file();

		if (data == null) {
			return errorReturn(`[${document}] No file sent`);
		}

		const contentType = data.mimetype;
		const originalFileName = encodeURIComponent(sanitizeFilename(decodeURIComponent(data.filename)));
		const fileName = crypto.createHash('md5').update(originalFileName).digest('hex');

		let fileContent = await data.toBuffer();

		if (data.encoding !== '7bit') {
			fileContent = Buffer.from(fileContent.toString('utf8'), data.encoding as BufferEncoding);
		}

		logger.trace({ contentType, originalFileName }, `Uploading file ${fileName}`);

		const directory = `${document}/${recordId}/${fieldName}`;
		const key = `${directory}/${fileName}${path.extname(originalFileName) ?? ''}`;

		const fileData: FileData = {
			key,
			kind: contentType,
			size: fileContent.length,
			name: originalFileName,
		};

		const filesToSave: Array<{
			name: string;
			content: Buffer;
		}> = [];

		if (/^image\/jpeg$/.test(contentType)) {
			logger.trace({ contentType, originalFileName }, `Resizing image ${originalFileName}`);
			let image = sharp(fileContent);
			const { width = 0, height = 0 } = await image.metadata();

			const maxWidth = MetaObject.Namespace.storage?.jpeg?.maxWidth ?? DEFAULT_JPEG_MAX_SIZE;
			const maxHeight = MetaObject.Namespace.storage?.jpeg?.maxHeight ?? DEFAULT_JPEG_MAX_SIZE;

			if (width > maxWidth || height > maxHeight) {
				image = image.resize({
					width: maxWidth,
					height: maxHeight,
					fit: 'inside',
				});
			}

			image = image.jpeg({
				quality: MetaObject.Namespace.storage?.jpeg?.quality ?? DEFAULT_JPEG_QUALITY,
				force: true,
			});

			const imageBuffer = await image.toBuffer();
			filesToSave.push({ name: `${fileName}.jpeg`, content: imageBuffer });
			fileData.size = imageBuffer.length;

			// Generate thumbnail for jpeg
			const thumbnailFile = await generateFileVersion({
				filename: fileName,
				originalImage: image,
				version: THUMBNAIL_CONFIG,
				name: 'thumbnail',
				extraParams: { fit: 'cover' },
				forceJpeg: true,
			});
			if (thumbnailFile != null) {
				filesToSave.push(thumbnailFile);
			}
		} else {
			// Non-jpeg files
			filesToSave.push({ name: fileData.key.split('/').at(-1) ?? '', content: fileContent });

			const thumbnailFile = await generateFileVersion({
				filename: fileName,
				originalImage: sharp(Buffer.from(generateFileThumbnailSvg(originalFileName))),
				version: THUMBNAIL_CONFIG,
				name: 'thumbnail',
				extraParams: {
					fit: sharp.fit.contain,
					position: sharp.gravity.center,
					background: '#cccccc',
				},
				forceJpeg: true,
			});

			if (thumbnailFile != null) {
				filesToSave.push(thumbnailFile);
			}
		}

		if (/^image\//.test(contentType)) {
			// Apply watermark to image files if needed
			if (MetaObject.Namespace.storage?.wm != null) {
				const watermarkImageResult = await applyWatermark(sharp(filesToSave[0].content));
				if (watermarkImageResult.success === false) {
					return reply.send(watermarkImageResult);
				}

				filesToSave.push({ name: path.join('watermark', `${fileName}.jpeg`), content: watermarkImageResult.data });
			}

			// Generate additional versions if needed
			if (Array.isArray(field.sizes) && field.sizes.length > 0 && MetaObject.Namespace.storage?.imageSizes != null) {
				const image = sharp(fileContent);
				const versionFiles = await Bluebird.map(field.sizes, async size => {
					const version = MetaObject.Namespace.storage?.imageSizes![size];
					if (version == null) {
						return null;
					}

					return generateFileVersion({
						filename: fileName,
						originalImage: image,
						version,
						name: size,
						forceJpeg: true,
					});
				});
				filesToSave.push(...versionFiles.filter(v => v != null));
			}
		}

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

type GenerateFileVersionParams = {
	filename: string;
	originalImage: sharp.Sharp;
	version: StorageImageSizeCfg;
	name: string;
	extraParams?: sharp.ResizeOptions;
	forceJpeg?: boolean;
};

const generateFileVersion = async ({ filename, originalImage, version, name, extraParams, forceJpeg }: GenerateFileVersionParams) => {
	const missingParams = getMissingParams(version, ['width', 'height']);
	if (missingParams.length > 0) {
		logger.warn(`[generateFileVersion] Missing params: ${missingParams.join(', ')}`);
		return null;
	}

	let imageBuffer: Buffer;
	const { width, height, wm } = version;

	const image = originalImage.resize({
		width,
		height,
		fit: 'inside',
		...extraParams,
	});

	if (wm) {
		const watermarkResult = await applyWatermark(image);
		if (watermarkResult.success === false) {
			return null;
		}
		imageBuffer = watermarkResult.data;
	} else {
		imageBuffer = await image.toBuffer();
	}

	if (forceJpeg) {
		imageBuffer = await sharp(imageBuffer)
			.jpeg({ quality: MetaObject.Namespace.storage?.jpeg?.quality ?? DEFAULT_JPEG_QUALITY, force: true })
			.toBuffer();
	}

	const nameWithoutExtension = path.basename(name, path.extname(name));

	return {
		name: name === 'thumbnail' ? path.join('thumbnail', `${filename}.jpeg`) : path.join(filename, forceJpeg ? `${nameWithoutExtension}.jpeg` : name),
		content: imageBuffer,
	};
};

export default fp(fileUploadApi);
