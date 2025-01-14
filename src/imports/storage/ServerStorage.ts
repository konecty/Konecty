import { z } from 'zod';
import FileStorage, { FileContext, FileData } from './FileStorage';

import { MetaObject } from '@imports/model/MetaObject';
import { ServerStorageCfg } from '@imports/model/Namespace/Storage';
import { logger } from '@imports/utils/logger';
import { errorReturn } from '@imports/utils/return';
import { Readable } from 'stream';

export default class ServerStorage implements FileStorage {
	storageCfg: FileStorage['storageCfg'];

	constructor(storageCfg: FileStorage['storageCfg']) {
		this.storageCfg = storageCfg;
	}

	async sendFile(fullUrl: string, filePath: string, reply: any) {
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
		const fd = new FormData();
		fd.append('file', new Blob([file.content]), file.name);

		const response = await fetch(`${storageCfg.config.upload}${uploadPath}`, {
			method: 'POST',
			body: fd,
			headers: {
				Authorization: context.authTokenId ?? '',
				Cookie: `_authTokenId=${context.authTokenId ?? ''}`,
				origin: context.headers.host ?? '',
				...(storageCfg.config.headers ?? {}),
			},
		});

		try {
			if (response.status > 399) {
				return errorReturn(await response.text());
			}

			return (await response.json()) as ReturnType<FileStorage['upload']>;
		} catch (e) {
			return errorReturn((e as Error).toString());
		}
	}

	async delete(directory: string, fileName: string, context: FileContext) {
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
			if (response.status > 399) {
				logger.error(await response.text(), `Error deleting file ${fileName} from server`);
			}
		} catch (e) {
			logger.error(e, `Error deleting file ${fileName} from server`);
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
