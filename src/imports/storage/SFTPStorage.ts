import type { FastifyReply } from 'fastify';

import { ALLOWED_CORS_FILE_TYPES, DEFAULT_EXPIRATION } from '@imports/consts';
import { fileUpload } from '@imports/file/file';
import { SFTPStorageCfg } from '@imports/model/Namespace/Storage';
import { getFileStorageDeletePathSuffixes } from '@imports/storage/fileStorageDeleteSuffixes';
import FileStorage, { type FileContext, FileData } from '@imports/storage/FileStorage';
import { logger } from '@imports/utils/logger';

import BluebirdPromise from 'bluebird';
import crypto from 'crypto';
import mime from 'mime-types';
import path from 'path';
import SftpClient from 'ssh2-sftp-client';
import { z } from 'zod';

/** Comprimento do MD5 em hex; basename do upload costuma ser só isso ou sufixo `-<md5>`. */
const MD5_HEX_STEM_LENGTH = 32;

const is32CharMd5Hex = (value: string) => value.length === MD5_HEX_STEM_LENGTH && /^[a-f0-9]+$/i.test(value);

const tryEtagFromUploadBasename = (filePath: string) => {
	const ext = path.posix.extname(filePath);
	const stem = ext ? path.posix.basename(filePath, ext) : path.posix.basename(filePath);
	if (!stem) {
		return null;
	}
	if (is32CharMd5Hex(stem)) {
		return stem.toLowerCase();
	}
	/** Ex.: `logo-agencia-…-<md5>.jpg` (fallback do upload) */
	const withLeadingDash = stem.match(/-([a-f0-9]{32})$/i);
	if (withLeadingDash?.[1] != null && is32CharMd5Hex(withLeadingDash[1])) {
		return withLeadingDash[1].toLowerCase();
	}
	return null;
};

export default class SFTPStorage implements FileStorage {
	storageCfg: FileStorage['storageCfg'];

	constructor(storageCfg: FileStorage['storageCfg']) {
		this.storageCfg = storageCfg;
	}

	private async withClient<T>(fn: (client: SftpClient) => Promise<T>): Promise<T> {
		const storageCfg = this.storageCfg as z.infer<typeof SFTPStorageCfg>;
		const client = new SftpClient();
		try {
			await client.connect({
				host: storageCfg.host,
				port: storageCfg.port ?? 22,
				username: storageCfg.username,
				password: storageCfg.password,
			});
			return await fn(client);
		} finally {
			try {
				await client.end();
			} catch (error) {
				logger.error(error, 'SFTP client end error');
			}
		}
	}

	async sendFile(_fullUrl: string, filePath: string, reply: FastifyReply) {
		logger.trace(`Proxying file ${filePath} from SFTP`);
		const storageCfg = this.storageCfg as z.infer<typeof SFTPStorageCfg>;
		const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
		const remotePath = path.posix.join(storageCfg.remoteRoot, filePath);

		try {
			const raw = await this.withClient(client => client.get(remotePath));
			if (!Buffer.isBuffer(raw)) {
				logger.error({ remotePath, type: typeof raw }, 'SFTP get did not return a buffer');
				return reply.status(500).send('Error retrieving file');
			}
			const fileContent = raw;
			/** Nome vindo do upload: stem ou sufixo contém o mesmo MD5 do ficheiro — evita recalcular o hash em ficheiros grandes. */
			const etagFromName = tryEtagFromUploadBasename(filePath);
			const etag = etagFromName ?? crypto.createHash('md5').update(fileContent).digest('hex');
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
			logger.error(error, `Error proxying file ${filePath} from SFTP`);
			return reply.status(404).send('Not found');
		}
	}

	async upload(fileData: FileData, filesToSave: { name: string; content: Buffer }[], context: FileContext) {
		fileData.etag = crypto.createHash('md5').update(filesToSave[0].content).digest('hex');
		const storageCfg = this.storageCfg as z.infer<typeof SFTPStorageCfg>;
		const remoteRoot = storageCfg.remoteRoot.replace(/\/$/, '');
		const relativeDir = path.posix.dirname(fileData.key);

		const uploadedRemotePaths: string[] = [];

		await this.withClient(async client => {
			await BluebirdPromise.each(filesToSave, async ({ name, content }) => {
				const remotePath = path.posix.join(remoteRoot, relativeDir, name);
				const remoteDir = path.posix.dirname(remotePath);
				await client.mkdir(remoteDir, true);
				await client.put(content, remotePath);
				uploadedRemotePaths.push(remotePath);
			});
		});

		const coreResponse = await fileUpload({
			contextUser: context.user,
			document: context.document,
			fieldName: context.fieldName,
			recordCode: context.recordId,
			body: fileData,
		});

		if (coreResponse.success === false) {
			await this.withClient(async client => {
				await BluebirdPromise.each(uploadedRemotePaths, async remotePath => {
					try {
						await client.delete(remotePath);
					} catch (error) {
						logger.error(error, `Error rolling back SFTP file ${remotePath}`);
					}
				});
			});
		}

		return coreResponse;
	}

	async delete(directory: string, fileName: string, context?: FileContext) {
		void context;
		const storageCfg = this.storageCfg as z.infer<typeof SFTPStorageCfg>;
		const remoteRoot = storageCfg.remoteRoot.replace(/\/$/, '');
		const normalizedDir = directory.split(path.sep).join('/');
		const baseDir = path.posix.join(remoteRoot, normalizedDir);
		const decoded = decodeURIComponent(fileName);
		const suffixes = getFileStorageDeletePathSuffixes(decoded, storageCfg?.wm != null);
		const pathsToDelete = suffixes.map(suffix => path.posix.join(baseDir, suffix));

		await this.withClient(async client => {
			await BluebirdPromise.each(pathsToDelete, async remotePath => {
				try {
					await client.delete(remotePath);
				} catch (error) {
					logger.error(error, `Error deleting file ${remotePath} from SFTP`);
				}
			});
		});
	}
}
