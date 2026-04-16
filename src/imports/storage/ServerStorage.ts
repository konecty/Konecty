import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import FileStorage, { FileContext, FileData } from './FileStorage';

import { MetaObject } from '@imports/model/MetaObject';
import { ServerStorageCfg } from '@imports/model/Namespace/Storage';
import { logger } from '@imports/utils/logger';
import { errorReturn } from '@imports/utils/return';
import { Readable } from 'stream';

const BOUNDARY_RANDOM_MAX = 1_000_000_000;
const BOUNDARY_PADDING_LENGTH = 9;
const HTTP_CLIENT_ERROR_MIN = 400;

const generateMultipartBoundary = (): string => {
	const timestamp = Date.now();
	const randomPart = Math.floor(Math.random() * BOUNDARY_RANDOM_MAX)
		.toString()
		.padStart(BOUNDARY_PADDING_LENGTH, '0');
	return `${timestamp}${randomPart}`;
};

const decodeFileNameSafely = (fileName: string): string => {
	try {
		return decodeURIComponent(fileName);
	} catch (error) {
		logger.trace({ fileName, error }, 'Failed to decode filename, using original');
		return fileName;
	}
};

const buildMultipartBody = (boundary: string, fileName: string, contentType: string, fileContent: Buffer): string =>
	[
		`--${boundary}`,
		`Content-Disposition: form-data; name="fileName"; filename="${fileName}"`,
		`Content-Type: ${contentType}`,
		'Content-Transfer-Encoding: base64',
		'',
		fileContent.toString('base64'),
		`--${boundary}--`,
		'',
	].join('\r\n');

export default class ServerStorage implements FileStorage {
	storageCfg: FileStorage['storageCfg'];

	constructor(storageCfg: FileStorage['storageCfg']) {
		this.storageCfg = storageCfg;
	}

	async sendFile(fullUrl: string, filePath: string, reply: FastifyReply) {
		const storageCfg = this.storageCfg as z.infer<typeof ServerStorageCfg>;
		logger.trace(`Proxying file ${filePath} from server ${storageCfg.config.preview}`);

		const proxyPath = this.formatProxyUrl(fullUrl, encodeURI(filePath));
		logger.trace({ originalUrl: fullUrl, proxyUrl: `${storageCfg.config.preview}${proxyPath}` });

		const response = await fetch(`${storageCfg.config.preview}${proxyPath}`);
		const stream = Readable.fromWeb(response.body!);
		return reply.send(stream);
	}

	async upload(fileData: FileData, filesToSave: { name: string; content: Buffer }[], context: FileContext) {
		const storageCfg = this.storageCfg as z.infer<typeof ServerStorageCfg>;
		const uploadPath = `/rest/file/upload/${MetaObject.Namespace.ns}/${context.accessId ?? 'konecty'}/${context.document}/${context.recordId}/${context.fieldName}`;

		const file = filesToSave[0];
		const boundary = generateMultipartBoundary();
		const decodedFileName = decodeFileNameSafely(fileData.name);
		const multipartBody = buildMultipartBody(boundary, decodedFileName, fileData.kind, file.content);

		logger.trace(
			{
				uploadUrl: `${storageCfg.config.upload}${uploadPath}`,
				fileName: decodedFileName,
				fileSize: file.content.length,
			},
			'Uploading file to server storage',
		);

		const response = await fetch(`${storageCfg.config.upload}${uploadPath}`, {
			method: 'POST',
			body: multipartBody,
			headers: {
				Authorization: context.authTokenId ?? '',
				Cookie: `_authTokenId=${context.authTokenId ?? ''}`,
				origin: context.headers.host ?? '',
				'Content-Type': `multipart/form-data; boundary=${boundary}`,
				...(storageCfg.config.headers ?? {}),
			},
		});

		try {
			if (response.status >= HTTP_CLIENT_ERROR_MIN) {
				const errorText = await response.text();
				logger.error({ statusCode: response.status, errorText, fileName: decodedFileName, uploadPath }, 'Server storage upload failed with HTTP error');
				return errorReturn(errorText);
			}

			logger.trace({ fileName: decodedFileName, statusCode: response.status }, 'File uploaded successfully to server storage');
			return (await response.json()) as ReturnType<FileStorage['upload']>;
		} catch (error) {
			logger.error({ error, fileName: decodedFileName, uploadPath }, 'Server storage upload failed with exception');
			return errorReturn((error as Error).toString());
		}
	}

	async delete(directory: string, fileName: string, context?: FileContext) {
		if (context == null) {
			logger.error({ directory, fileName }, 'Server storage delete skipped: missing file context');
			return;
		}
		const storageCfg = this.storageCfg as z.infer<typeof ServerStorageCfg>;
		const uploadPath = `/rest/file/delete/${MetaObject.Namespace.ns}/konecty/${directory}/${fileName}`;

		const response = await fetch(`${storageCfg.config.upload}${uploadPath}`, {
			method: 'DELETE',
			headers: {
				Authorization: context.authTokenId ?? '',
				Cookie: `_authTokenId=${context.authTokenId ?? ''}`,
				origin: context.headers.host ?? '',
				...(storageCfg.config.headers ?? {}),
			},
		});

		try {
			if (response.status >= HTTP_CLIENT_ERROR_MIN) {
				const errorText = await response.text();
				logger.error({ statusCode: response.status, errorText, fileName, directory }, 'Error deleting file from server storage');
			}
		} catch (error) {
			logger.error({ error, fileName, directory }, 'Server storage delete failed with exception');
		}
	}

	formatProxyUrl(fullUrl: string, filePath: string): string {
		// Get the url parts unrelated with namespace, file key or routing
		// ex: /rest/image/inner/1024/768/client-ns/WebElement/123/file/mamma-mia.png
		// would resolve to ["inner", "1024", "768"]
		const urlCfgParts = fullUrl
			.replace(filePath, '')
			.replace(/\?.*/, '')
			.replace(/(\/rest)?(\/(image|file))?/, '')
			.split('/')
			.filter(e => e?.length);

		if (/\/file\//.test(fullUrl)) {
			if (urlCfgParts.length === 0) {
				fullUrl = fullUrl.replace(filePath, `preview/${filePath}`);
			}
		}

		if (fullUrl.startsWith('/rest') === false) {
			fullUrl = `/rest${fullUrl}`;
		}

		if (fullUrl.includes(`${MetaObject.Namespace.ns}/`) === false) {
			fullUrl = fullUrl.replace(filePath, `${MetaObject.Namespace.ns}/${filePath}`);
		}

		fullUrl = fullUrl.replace(/\/\//g, '');

		return fullUrl;
	}
}
