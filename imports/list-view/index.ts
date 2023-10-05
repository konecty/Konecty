import sortBy from 'lodash/sortBy';
import { DocumentListSchema } from '/imports/model/DocumentList';
import { MetaObjectCollection } from '/imports/model/MetaObject';
import { MetaObjectType } from '/imports/types/metadata';
import { logger } from '/imports/utils/logger';

export async function listView(document: string, id: string) {
	const list = await MetaObjectCollection.findOne<MetaObjectType>({ type: 'list', document: document, name: id, menuSorter: { $nin: [-1, -2, -3] } });

	if (list?.type != 'list') {
		throw new Error(`List ${document}/${id} not found`);
	}

	const columnsArray = Object.entries(list.columns).map(([, value]) => value);

	const listColumns = sortBy(columnsArray, ['sort', 'name']);

	const filtersList = sortBy(
		Object.entries(list.filter?.conditions).map(([, value]) => value),
		['sort', 'term'],
	);

	const listViewResult = DocumentListSchema.safeParse({
		...list,
		filter: filtersList,
		document,
		columns: listColumns,
		label: list.label['en'],
		plurals: list.plurals['en'],
	});

	if (listViewResult.success === false) {
		logger.error(
			{
				list,
				error: listViewResult.error,
			},
			`Error parsing list view ${document}/${id}`,
		);
		return null;
	}

	return listViewResult.data;
}
