import FileStorage, { FileContext, FileData } from './FileStorage';

import { ALLOWED_CORS_FILE_TYPES, DEFAULT_EXPIRATION } from '@imports/consts';
import { fileUpload } from '@imports/file/file';
import { logger } from '@imports/utils/logger';

import crypto from 'crypto';
import { readFile, unlink, writeFile } from 'fs/promises';
import mime from 'mime-types';
import { mkdirp } from 'mkdirp';
import path from 'path';

import { FSStorageCfg } from '@imports/model/Namespace';
import BluebirdPromise from 'bluebird';
import { z } from 'zod';

export default class FSStorage implements FileStorage {
	declare storageCfg: FileStorage['storageCfg'];

	constructor(storageCfg: FileStorage['storageCfg']) {
		this.storageCfg = storageCfg;
	}

	async sendFile(fullUrl: string, filePath: string, reply: any) {
		logger.trace(`Proxying file ${filePath} from FS`);
		const storageCfg = this.storageCfg as z.infer<typeof FSStorageCfg>;
		const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
		const directory = storageCfg.directory ?? '/tmp';
		const fullPath = path.join(directory, filePath);

		try {
			const fileContent = await readFile(fullPath);
			const etag = crypto.createHash('md5').update(fileContent).digest('hex');
			const contentType = mime.lookup(filePath) || 'application/octet-stream';
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

	async upload(fileData: FileData, filesToSave: { name: string; content: Buffer }[], context: FileContext) {
		fileData.etag = crypto.createHash('md5').update(filesToSave[0].content).digest('hex');
		const storageCfg = this.storageCfg as z.infer<typeof FSStorageCfg>;
		const storageDirectory = storageCfg.directory ?? '/tmp';
		const fileDirectory = path.join(storageDirectory, fileData.key.replace(fileData.name, ''));

		await mkdirp(fileDirectory);

		await BluebirdPromise.each(filesToSave, async ({ name, content }) => {
			const filePath = path.join(fileDirectory, name);
			await writeFile(filePath, content);
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
				await unlink(path.join(fileDirectory, name));
			});
		}

		return coreResponse;
	}

	async delete(directory: string, fileName: string) {
		const storageCfg = this.storageCfg as z.infer<typeof FSStorageCfg>;
		directory = `${storageCfg.directory ?? '/tmp'}/${directory}`;

		const fullPath = path.join(directory, decodeURIComponent(fileName));
		const thumbnailFullPath = path.join(directory, 'thumbnail', decodeURIComponent(fileName));
		const watermarkFullPath = path.join(directory, 'watermark', decodeURIComponent(fileName));
		try {
			unlink(fullPath);
		} catch (error) {
			logger.error(error, `Error deleting file ${fileName} from FS`);
		}

		try {
			unlink(thumbnailFullPath);
		} catch (error) {
			logger.error(error, `Error deleting thumbnail file ${fileName} from FS`);
		}

		if (storageCfg?.wm != null) {
			try {
				unlink(watermarkFullPath);
			} catch (error) {
				logger.error(error, `Error deleting watermark file ${fileName} from FS`);
			}
		}
	}
}
