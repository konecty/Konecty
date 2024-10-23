import { FastifyReply } from 'fastify';

import { MetaObject } from '@imports/model/MetaObject';
import FileStorage from '@imports/storage/FileStorage';

export async function sendFile(reply: FastifyReply, fullUrl: string, filePath: string) {
	const fileStorage = FileStorage.fromNamespaceStorage(MetaObject.Namespace.storage);

	await fileStorage.sendFile(fullUrl, filePath, reply);
}
