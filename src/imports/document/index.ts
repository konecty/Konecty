import { DocumentSchema } from '../model/Document';
import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectType } from '@imports/types/metadata';
import { logger } from '@imports/utils/logger';

export async function getDocument(id: string) {
	const document = await MetaObject.MetaObject.findOne<MetaObjectType>({ type: 'document', name: id, menuSorter: { $nin: [-1, -2, -3] } });

	if (document?.type != 'document') {
		throw new Error(`Document ${id} not found`);
	}

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
