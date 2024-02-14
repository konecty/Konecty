import first from 'lodash/first';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

import { flatten } from 'flat';

import { MetaObject } from '@imports/model/MetaObject';

import { find } from '@imports/data/data';

import { errorReturn, successReturn } from '@imports/utils/return';

import { csvExport } from '@imports/exports/csvExport';
import { xlsExport } from '@imports/exports/xlsExport';
import { List } from '@imports/model/List';
import { User } from '@imports/model/User';
import { KonectyResult } from '@imports/types/result';

type ExportDataParams = {
	document: string;
	listName: string;
	type: 'csv' | 'xls';
	user: User;

	displayName?: string;
	displayType?: string;

	filter?: string | object;
	sort?: string;
	fields?: string;
	limit?: number;
	start?: number;
};

type ExportDataResponse = {
	httpHeaders: Record<string, string>;
	content: string | Buffer;
};

export default async function exportData({ document, listName, type = 'csv', user, ...query }: ExportDataParams): Promise<KonectyResult<ExportDataResponse>> {
	const listMeta = (await MetaObject.MetaObject.findOne({
		type: 'list',
		document,
		name: listName,
	})) as List;

	if (listMeta == null) {
		return errorReturn(`[${document}] Can't find list ${listName} of document ${document}`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Can't find meta`);
	}

	const userLocale = user.locale ?? 'en';

	const getLabel = () => {
		if (listMeta.plurals != null) {
			return listMeta.plurals[userLocale] ?? listMeta.plurals.en ?? first(Object.values(listMeta.plurals));
		}
		if (listMeta.label != null) {
			return listMeta.label[userLocale] ?? listMeta.label.en ?? first(Object.values(listMeta.label));
		}
		if (metaObject.plurals != null) {
			return metaObject.plurals[userLocale] ?? metaObject.plurals.en ?? first(Object.values(metaObject.plurals));
		}
		if (metaObject.label != null) {
			return metaObject.label[userLocale] ?? metaObject.label.en ?? first(Object.values(metaObject.label));
		}
		return document;
	};

	const name = getLabel();

	if (isString(query.filter) === false && isObject(listMeta.filter)) {
		query.filter = JSON.stringify(listMeta.filter);
	}

	if (isString(query.sort) === false && isArray(listMeta.sorters)) {
		query.sort = JSON.stringify(listMeta.sorters);
	}

	const getFields = () => {
		if (isString(query.fields)) {
			return query.fields;
		}
		if (isObject(listMeta.columns)) {
			return Object.values(listMeta.columns)
				.filter(column => column.visible === true)
				.map(column => column.linkField)
				.join(',');
		}
		return undefined;
	};

	const fields = getFields();

	const filter = isString(query.filter) ? JSON.parse(query.filter) : undefined;

	const result = await find({
		contextUser: user,
		document,
		displayName: query.displayName,
		displayType: query.displayType,
		fields,
		filter,
		sort: query.sort,
		limit: query.limit,
		start: query.start,
		withDetailFields: 'true',
		getTotal: true,
	});

	if (result == null || result.success === false) {
		return result;
	}

	const dataResult = result.data.reduce(
		(acc: { flatData: object[]; keys: Record<string, number> }, item) => {
			const flatItem = flatten<object, object>(item);

			acc.flatData.push(flatItem);
			Object.keys(flatItem as object).forEach(key => (acc.keys[key] = 1));

			return acc;
		},
		{ flatData: [], keys: {} },
	);

	if (type === 'xls') {
		return successReturn(await xlsExport(Object.keys(dataResult.keys), dataResult.flatData, name));
	}

	return successReturn(csvExport(Object.keys(dataResult.keys), dataResult.flatData, name));
}
