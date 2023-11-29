import { FastifyReply } from 'fastify';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import crypto from 'crypto';
import mime from 'mime-types';

import { readFile } from 'fs/promises';
import { request } from 'undici';

import path from 'path';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';

import { ALLOWED_CORS_FILE_TYPES, DEFAULT_EXPIRATION } from '@imports/consts';

export async function sendFile(filePath: string, reply: FastifyReply) {
	const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
	if (MetaObject.Namespace.storage?.type === 's3') {
		logger.trace(`Proxying file ${MetaObject.Namespace.storage.publicUrl}/${filePath} from S3`);
		if (MetaObject.Namespace.storage?.publicUrl != null) {
			const { statusCode, headers, body } = await request(`${MetaObject.Namespace.storage.publicUrl}/${filePath}`);

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
			const s3 = new S3Client(MetaObject.Namespace.storage?.config ?? {});

			logger.trace(
				{
					Bucket: MetaObject.Namespace.storage.bucket,
					Key: filePath,
				},
				`Proxying file ${filePath} from S3 bucket`,
			);

			try {
				const s3Result = await s3.send(
					new GetObjectCommand({
						Bucket: MetaObject.Namespace.storage.bucket,
						Key: filePath,
					}),
				);

				const { ETag, ContentType, ContentLength, Body } = s3Result;

				logger.trace(
					{
						params: {
							Bucket: MetaObject.Namespace.storage.bucket,
							Key: filePath,
						},
						result: s3Result,
					},
					`Proxying file ${filePath} from S3`,
				);

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
				logger.error(error, `Error proxying file ${filePath} from S3`);
				if ((error as any).type === 'NoSuchKey') {
					return reply.status(404).send('Not found');
				}

				return reply.status(500).send('Error retrieving file');
			}
		}
	}

	logger.trace(`Proxying file ${filePath} from FS`);
	const fullPath = path.join(MetaObject.Namespace.storage?.directory ?? '/tmp', filePath);
	try {
		const fileContent = await readFile(fullPath);
		const etag = crypto.createHash('md5').update(fileContent).digest('hex');
		const contentType = mime.lookup(filePath) ?? 'application/octet-stream';
		return reply
			.headers({
				'content-type': contentType,
				'content-length': fileContent.length,
				'keep-alive': 'timeout=5',
				etag,
				'cache-control': `public, max-age=${DEFAULT_EXPIRATION}`,
				'access-control-allow-origin': ALLOWED_CORS_FILE_TYPES.includes(ext) ? '*' : 'same-origin',
			})
			.send(fileContent);
	} catch (error) {
		logger.error(error, `Error proxying file ${filePath} from FS`);
		return reply.status(404).send('Not found');
	}
}
