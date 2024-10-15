import { z } from 'zod';
import FileStorage, { FileContext, FileData } from './FileStorage';

import { MetaObject } from '@imports/model/MetaObject';
import { ServerStorageCfg } from '@imports/model/Namespace';
import { logger } from '@imports/utils/logger';
import { Readable } from 'stream';

export default class ServerStorage implements FileStorage {
	storageCfg: FileStorage['storageCfg'];

	constructor(storageCfg: FileStorage['storageCfg']) {
		this.storageCfg = storageCfg;
	}

	async sendFile(fullUrl: string, filePath: string, reply: any) {
		const storageCfg = this.storageCfg as z.infer<typeof ServerStorageCfg>;
		logger.trace(`Proxying file ${filePath} from server ${storageCfg.config.preview}`);

		const urlCfgParts = fullUrl
			.replace(filePath, '')
			.replace(/\?.*/, '')
			.replace(/\/rest\/(image|file)\/(preview\/)?/, '')
			.split('/')
			.filter(e => e?.length);

		if (urlCfgParts.length === 0) {
			fullUrl = fullUrl.replace(filePath, `inner/1024/768/${MetaObject.Namespace.ns}/${filePath}`);
		} else if (urlCfgParts.length === 1) {
			fullUrl = fullUrl.replace(filePath, `${MetaObject.Namespace.ns}/${filePath}`);
		}

		fullUrl = fullUrl.replace(/\/\//g, '');
		logger.info({ fullUrl, urlCfgParts });

		const response = await fetch(`${storageCfg.config.preview}${fullUrl}`);
		const stream = Readable.fromWeb(response.body!);
		return reply.send(stream);
	}

	async upload(fileData: FileData, filesToSave: { name: string; content: Buffer }[], context: FileContext) {
		const storageCfg = this.storageCfg as z.infer<typeof ServerStorageCfg>;
		return {};
	}

	async delete(directory: string, fileName: string) {
		const storageCfg = this.storageCfg as z.infer<typeof ServerStorageCfg>;
	}
}
