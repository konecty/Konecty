import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import { DocumentSchema } from '../model/Document';

export async function getDocument(id: string, type: keyof typeof MetaObject = 'Meta') {
	const metaStore = MetaObject[type];
	if (metaStore == null) {
		throw new Error(`Meta store ${type} not found`);
	}

	const document = metaStore[id as keyof typeof metaStore];
	if (document == null) {
		throw new Error(`Document ${id} not found`);
	}

	if (type === 'Meta') {
		const getDocumentResult = DocumentSchema.safeParse(document);

		if (getDocumentResult.success === false) {
			logger.error(
				{
					form: document,
					error: getDocumentResult.error,
				},
				`Error parsing document ${id}`,
			);
			return null;
		}

		return getDocumentResult.data;
	}

	return document;
}
