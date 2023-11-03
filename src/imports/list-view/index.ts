import sortBy from 'lodash/sortBy';

import { MetaObject } from '@imports/model/MetaObject';
import { DocumentListSchema } from '@imports/model/DocumentList';
import { logger } from '../utils/logger';
import { MetaObjectType } from '../types/metadata';

export async function listView(document: string, id: string) {
	const list = await MetaObject.MetaObject.findOne<MetaObjectType>({ type: 'list', document: document, name: id, menuSorter: { $nin: [-1, -2, -3] } });

	if (list?.type != 'list') {
		throw new Error(`List ${document}/${id} not found`);
	}

	const columnsArray = Object.entries(list.columns).map(([, value]) => value);

	const listColumns = sortBy(columnsArray, ['sort', 'name']);

	const filtersList = sortBy(Object.values(list.filter?.conditions), ['sort', 'term']);

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

	if (listViewResult.data.boards) {
		const metaDocument = (await MetaObject.MetaObject.findOne<MetaObjectType>({ type: 'document', name: document })) as any;

		const newBoards = listViewResult.data.boards.flatMap(item => {
			const groupByField = metaDocument?.fields[item.groupBy.field];

			if (groupByField == null || groupByField.type !== 'picklist') {
				return [];
			}

			const values = sortBy(
				Object.entries(groupByField.options).map(([key, value]: [string, any]) => ({
					value: key,
					sort: value.sort,
				})),
				['sort', 'value'],
			).map(item => item.value);

			return {
				...item,
				groupBy: {
					...item.groupBy,
					values,
				},
			};
		});

		listViewResult.data.boards = newBoards;
	}

	return listViewResult.data;
}
