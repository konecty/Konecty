import { Namespace } from '@imports/model/Namespace';
import { User } from '@imports/model/User';
import { IncomingHttpHeaders } from 'undici/types/header';
import FSStorage from './FSStorage';
import S3Storage from './S3Storage';
import ServerStorage from './ServerStorage';

export default abstract class FileStorage {
	storageCfg: Required<Namespace>['storage'];

	static fromNamespaceStorage(storageCfg?: FileStorage['storageCfg']): FileStorage {
		switch (storageCfg?.type) {
			case 's3':
				return new S3Storage(storageCfg);
			case 'server':
				return new ServerStorage(storageCfg);
			case 'fs':
			default:
				return new FSStorage(storageCfg ?? { type: 'fs' });
		}
	}

	constructor(storageCfg: FileStorage['storageCfg']) {
		this.storageCfg = storageCfg;
	}

	abstract sendFile(fullUrl: string, filePath: string, reply: any): Promise<void>;
	abstract upload(fileData: FileData, filesToSave: { name: string; content: Buffer }[], context: FileContext): Promise<Record<string, unknown>>;
	abstract delete(directory: string, fileName: string, context: FileContext): Promise<void>;
}

export type FileData = {
	key: string;
	kind: string;
	size: number;
	name: string;
	etag?: string;
	version?: string;
};

export type FileContext = {
	namespace?: string;
	accessId?: string;
	document: string;
	recordId: string;
	fieldName: string;
	fileName: string;
	user: User;
	authTokenId?: string;
	headers: IncomingHttpHeaders;
};
