import { Form } from '@imports/model/Form';
import { List } from '@imports/model/List';
import sortBy from 'lodash/sortBy';

const metaFormatter: Record<string, (meta: any) => any> = {
	list: (meta: List) => {
		const columnsList = sortBy(Object.values(meta?.columns || {}), ['sort', 'name']);

		const filtersList = sortBy(Object.values(meta.filter?.conditions || {}), ['sort', 'term']);

		return {
			...meta,
			filter: filtersList,
			columns: columnsList,
			label: meta.label.en,
			plurals: meta.plurals.en,
		};
	},
	view: (meta: Form) => {
		return {
			...meta,
			label: meta.label.en,
			plurals: meta.plurals.en,
		};
	},
};

export default metaFormatter;
