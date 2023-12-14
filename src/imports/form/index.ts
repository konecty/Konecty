import { MetaObject } from '@imports/model/MetaObject';
import { DocumentFormSchema } from '@imports/model/DocumentForm';
import { logger } from '../utils/logger';
import { MetaObjectType } from '../types/metadata';

export async function getDocumentForm(document: string, id: string) {
	const form = await MetaObject.MetaObject.findOne<MetaObjectType>({ type: 'view', document: document, name: id, menuSorter: { $nin: [-1, -2, -3] } });

	if (form?.type != 'view') {
		throw new Error(`Form for ${document}/${id} not found`);
	}

	const getDocumentFormResult = DocumentFormSchema.safeParse({
		...form,
		document,
		label: form.label['en'],
		plurals: form.plurals['en'],
	});

	if (getDocumentFormResult.success === false) {
		logger.error(
			{
				form,
				error: getDocumentFormResult.error,
			},
			`Error parsing form ${document}/${id}`,
		);
		return null;
	}

	return getDocumentFormResult.data;
}
