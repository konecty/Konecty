import BluebirdPromise from 'bluebird';

import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { ALLOWED_CORS_FILE_TYPES, DEFAULT_EXPIRATION } from '@imports/consts';
import { fileUpload } from '@imports/file/file';
import { S3StorageCfg } from '@imports/model/Namespace';
import FileStorage, { FileContext, FileData } from '@imports/storage/FileStorage';
import { logger } from '@imports/utils/logger';

import crypto from 'crypto';
import { request } from 'undici';
import { z } from 'zod';

export default class S3Storage implements FileStorage {
	storageCfg: FileStorage['storageCfg'];

	constructor(storageCfg: FileStorage['storageCfg']) {
		this.storageCfg = storageCfg;
	}

	async sendFile(fullUrl: string, filePath: string, reply: any) {
		logger.trace(`Proxying file ${filePath} from S3`);
		const storageCfg = this.storageCfg as z.infer<typeof S3StorageCfg>;
		const ext = filePath.split('.').pop()?.toLowerCase() ?? '';

		if (storageCfg.publicUrl != null) {
			logger.trace(`Proxying file ${storageCfg.publicUrl}/${filePath} from S3`);
			const { statusCode, headers, body } = await request(`${storageCfg.publicUrl}/${filePath}`);

			if (statusCode !== 200) {
				return reply.status(statusCode).send(body);
			}

			const getEtag = () => {
				if (headers.etag != null) {
					return headers.etag;
				}

				if (Object.keys(headers).includes('x-amz-meta-etag')) {
					return headers['x-amz-meta-etag'];
				}

				if (Object.keys(headers).includes('x-bz-content-sha1')) {
					return headers['x-bz-content-sha1'];
				}

				return crypto.createHash('md5').update(filePath).digest('hex');
			};

			return reply
				.status(statusCode)
				.headers({
					'content-type': headers['content-type'] ?? 'application/octet-stream',
					'content-length': headers['content-length'] ?? '0',
					'keep-alive': 'timeout=5',
					etag: getEtag(),
					'cache-control': `public, max-age=${DEFAULT_EXPIRATION}`,
					'access-control-allow-origin': ALLOWED_CORS_FILE_TYPES.includes(ext) ? '*' : 'same-origin',
				})
				.send(body);
		} else {
			const s3 = new S3Client(storageCfg.config ?? {});

			logger.trace({ Bucket: storageCfg.bucket, Key: filePath }, `Proxying file ${filePath} from S3 bucket`);

			try {
				const s3Result = await s3.send(
					new GetObjectCommand({
						Bucket: storageCfg.bucket,
						Key: filePath,
					}),
				);

				const { ETag, ContentType, ContentLength, Body } = s3Result;

				return reply
					.headers({
						'content-type': ContentType ?? 'application/octet-stream',
						'content-length': ContentLength ?? '0',
						'keep-alive': 'timeout=5',
						etag: (ETag ?? '').replace(/"/g, ''),
						'cache-control': `public, max-age=${DEFAULT_EXPIRATION}`,
						'access-control-allow-origin': ALLOWED_CORS_FILE_TYPES.includes(ext) ? '*' : 'same-origin',
					})
					.send(Body);
			} catch (error) {
				if (error instanceof NoSuchKey) {
					return reply.status(404).send('Not found');
				}
				logger.error(error, `Error proxying file ${filePath} from S3`);
				return reply.status(500).send('Error retrieving file');
			}
		}
	}

	async upload(fileData: FileData, filesToSave: { name: string; content: Buffer }[], context: FileContext) {
		const storageCfg = this.storageCfg as z.infer<typeof S3StorageCfg>;

		const s3 = new S3Client(storageCfg.config ?? {});
		const bucket = storageCfg.bucket;
		const fileDirectory = fileData.key.replace(fileData.name, '');

		await BluebirdPromise.each(filesToSave, async ({ name, content }, index) => {
			const s3Result = await s3.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: `${fileDirectory}/${name}`,
					ContentType: fileData.kind,
					Body: content,
				}),
			);

			const { ETag, VersionId } = s3Result;

			logger.trace(
				{
					params: { Bucket: bucket, Key: fileData.key, ContentType: fileData.kind },
					result: s3Result.$metadata,
				},
				`Uploaded file ${fileData.name} to S3`,
			);

			if (index === 0) {
				fileData.etag = (ETag ?? '').replace(/"/g, '');
				fileData.version = VersionId;
			}
		});

		const coreResponse = await fileUpload({
			contextUser: context.user,
			document: context.document,
			fieldName: context.fieldName,
			recordCode: context.recordId,
			body: fileData,
		});

		if (coreResponse.success === false) {
			await BluebirdPromise.each(filesToSave, async ({ name }) => {
				await s3.send(
					new DeleteObjectCommand({
						Bucket: bucket,
						Key: `${fileDirectory}/${name}`,
						VersionId: fileData.version,
					}),
				);
			});
		}

		return coreResponse;
	}

	async delete(directory: string, fileName: string) {
		const storageCfg = this.storageCfg as z.infer<typeof S3StorageCfg>;
		const s3 = new S3Client(storageCfg?.config ?? {});

		try {
			await s3.send(
				new DeleteObjectCommand({
					Bucket: storageCfg.bucket,
					Key: `${directory}/${fileName}`,
				}),
			);
		} catch (e) {
			logger.error(e, `Error deleting file ${fileName} from S3`);
		}

		try {
			await s3.send(
				new DeleteObjectCommand({
					Bucket: storageCfg.bucket,
					Key: `${directory}/thumbnail/${fileName}`,
				}),
			);
		} catch (e) {
			logger.error(e, `Error deleting thumbnail file ${fileName} from S3`);
		}

		if (storageCfg?.wm != null) {
			try {
				await s3.send(
					new DeleteObjectCommand({
						Bucket: storageCfg.bucket,
						Key: `${directory}/watermark/${fileName}`,
					}),
				);
			} catch (e) {
				logger.error(e, `Error deleting watermark file ${fileName} from S3`);
			}
		}
	}
}
