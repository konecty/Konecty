import type { FastifyReply } from 'fastify';

import { ALLOWED_CORS_FILE_TYPES, DEFAULT_EXPIRATION } from '@imports/consts';
import { fileUpload } from '@imports/file/file';
import { MetaObject } from '@imports/model/MetaObject';
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

export type SFTPResolveDeleteFromRecordParams = {
	document: string;
	recordId: string;
	fieldName: string;
	fileNameParam: string;
};

export type SFTPResolvedDeleteTarget = {
	/** Relativo à raiz do storage (ex.: `Office/<id>/pictures`). */
	directory: string;
	basename: string;
	/** `name` do anexo no Mongo, para o `fileRemove` quando o param da rota não coincide. */
	nameForFileRemove?: string;
};

export default class SFTPStorage implements FileStorage {
	storageCfg: FileStorage['storageCfg'];

	constructor(storageCfg: FileStorage['storageCfg']) {
		this.storageCfg = storageCfg;
	}

	private static toFallbackDeleteTarget(document: string, recordId: string, fieldName: string, fileNameParam: string): SFTPResolvedDeleteTarget {
		let decoded = fileNameParam;
		try {
			decoded = decodeURIComponent(fileNameParam);
		} catch {
			decoded = fileNameParam;
		}
		const posixParam = fileNameParam.split(path.sep).join('/');
		const decodedPosix = decoded.split(path.sep).join('/');
		return {
			directory: path.posix.join(document, recordId, fieldName),
			basename: path.posix.basename(decodedPosix || posixParam),
		};
	}

	/** Só usado com storage SFTP na rota REST de delete: lê a `key` do registo (code vs _id, basename = hash+ext). */
	static async resolveDeleteTargetFromRecord(params: SFTPResolveDeleteFromRecordParams): Promise<SFTPResolvedDeleteTarget> {
		const { document, recordId, fieldName, fileNameParam } = params;
		try {
			const meta = MetaObject.Meta[document];
			if (meta == null) {
				return SFTPStorage.toFallbackDeleteTarget(document, recordId, fieldName, fileNameParam);
			}
			const field = meta.fields[fieldName];
			if (field == null || field.type !== 'file') {
				return SFTPStorage.toFallbackDeleteTarget(document, recordId, fieldName, fileNameParam);
			}
			const collection = MetaObject.Collections[document];
			if (collection == null) {
				return SFTPStorage.toFallbackDeleteTarget(document, recordId, fieldName, fileNameParam);
			}

			const record = await collection.findOne({
				$or: [{ _id: recordId }, ...(!Number.isNaN(Number(recordId)) ? [{ code: Number(recordId) }] : [])],
			});
			if (record == null) {
				return SFTPStorage.toFallbackDeleteTarget(document, recordId, fieldName, fileNameParam);
			}

			let decoded = fileNameParam;
			try {
				decoded = decodeURIComponent(fileNameParam);
			} catch {
				decoded = fileNameParam;
			}

			const matchesEntry = (entry: { name?: string; key?: string } | null | undefined) => {
				if (entry == null) {
					return false;
				}
				const keyPosix = typeof entry.key === 'string' ? entry.key.split(path.sep).join('/') : '';
				const keyBasename = keyPosix !== '' ? path.posix.basename(keyPosix) : '';
				const expectedWithParam = `${document}/${recordId}/${fieldName}/${fileNameParam}`;
				const expectedWithDecoded = `${document}/${recordId}/${fieldName}/${decoded}`;
				return (
					entry.name === fileNameParam ||
					entry.name === decoded ||
					keyPosix === expectedWithParam ||
					keyPosix === expectedWithDecoded ||
					keyBasename === fileNameParam ||
					keyBasename === decoded
				);
			};

			const fieldData = record[field.name];
			if (field.isList === true) {
				const list = Array.isArray(fieldData) ? fieldData : [];
				const entry = list.find(matchesEntry);
				if (entry?.key != null && typeof entry.key === 'string') {
					const posixKey = entry.key.split(path.sep).join('/');
					const nameForFileRemove = typeof entry.name === 'string' && entry.name !== '' ? entry.name : undefined;
					return {
						directory: path.posix.dirname(posixKey),
						basename: path.posix.basename(posixKey),
						...(nameForFileRemove != null ? { nameForFileRemove } : {}),
					};
				}
			} else {
				const single = fieldData as { name?: string; key?: string } | null | undefined;
				if (matchesEntry(single) && single?.key != null && typeof single.key === 'string') {
					const posixKey = single.key.split(path.sep).join('/');
					const nameForFileRemove = typeof single.name === 'string' && single.name !== '' ? single.name : undefined;
					return {
						directory: path.posix.dirname(posixKey),
						basename: path.posix.basename(posixKey),
						...(nameForFileRemove != null ? { nameForFileRemove } : {}),
					};
				}
			}
		} catch (error) {
			logger.error(error, 'SFTPStorage.resolveDeleteTargetFromRecord: failed to resolve path');
		}
		return SFTPStorage.toFallbackDeleteTarget(document, recordId, fieldName, fileNameParam);
	}

	private static readonly MD5_ETAG_HEX_LENGTH = 32;

	private static is32CharMd5Hex(value: string): boolean {
		return value.length === SFTPStorage.MD5_ETAG_HEX_LENGTH && /^[a-f0-9]+$/i.test(value);
	}

	/**
	 * Tenta reutilizar o MD5 do nome (basename `hash` ou sufixo `-<hash>`, p.ex. ficheiros antigos) no ETag.
	 */
	private static tryEtagFromUploadBasename(filePath: string): string | null {
		const ext = path.posix.extname(filePath);
		const stem = ext ? path.posix.basename(filePath, ext) : path.posix.basename(filePath);
		if (!stem) {
			return null;
		}
		if (SFTPStorage.is32CharMd5Hex(stem)) {
			return stem.toLowerCase();
		}
		const withLeadingDash = stem.match(/-([a-f0-9]{32})$/i);
		if (withLeadingDash?.[1] != null && SFTPStorage.is32CharMd5Hex(withLeadingDash[1])) {
			return withLeadingDash[1].toLowerCase();
		}
		return null;
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
			const etagFromName = SFTPStorage.tryEtagFromUploadBasename(filePath);
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
