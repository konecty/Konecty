import first from 'lodash/first';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

import { Span } from '@opentelemetry/api';
import { flatten } from 'flat';

import { find } from '@imports/data/api';
import { MetaObject } from '@imports/model/MetaObject';
import { errorReturn } from '@imports/utils/return';

import csvExport from '@imports/exports/csvExport';
import xlsExport from '@imports/exports/xlsExport';
import { User } from '@imports/model/User';
import { KonectyResult } from '@imports/types/result';
import internal, { Stream, Transform } from 'node:stream';
import { dateToString } from './dateParser';

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

	tracingSpan?: Span;
};

export type ExportDataResponse = {
	httpHeaders: Record<string, string>;
	content: Stream | Buffer;
};

export default async function exportData({ document, listName, type = 'csv', user, tracingSpan, ...query }: ExportDataParams): Promise<KonectyResult<ExportDataResponse>> {
	const listMeta = MetaObject.DisplayMeta[`${document}:list:${listName}`];

	if (listMeta == null || listMeta.type !== 'list') {
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
	tracingSpan?.setAttribute('name', name);

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

	tracingSpan?.addEvent('Executing find');
	const result = await find({
		contextUser: user,
		document,
		displayName: query.displayName,
		displayType: query.displayType,
		fields,
		filter,
		limit: query.limit,
		start: query.start,
		withDetailFields: 'true',
		getTotal: false,
		transformDatesToString: false,
		asStream: true,
		tracingSpan,
	});

	if (result == null || result.success === false) {
		return result;
	}
	if (result.data instanceof Stream === false) {
		return errorReturn('Oops something wen wrong! [data-not-stream]');
	}

	tracingSpan?.addEvent('Flattening data');
	const dataStream = result.data;

	if (type === 'xls') {
		return xlsExport(dataStream, name);
	}

	return csvExport(dataStream, name);
}

export class TransformFlattenData extends Transform {
	headers: Set<string> = new Set<string>();
	dateFormat: string;

	constructor(dateFormat?: string) {
		super({ objectMode: true, defaultEncoding: 'utf8' });
		this.dateFormat = dateFormat ?? MetaObject.Namespace.dateFormat ?? 'dd/MM/yyyy HH:mm:ss';
	}

	_transform(record: Record<string, unknown>, encoding: string, callback: internal.TransformCallback) {
		const flatItem = flatten<object, object>(record);
		const transformed = dateToString(flatItem, date => date.toFormat(this.dateFormat));

		for (const key of Object.keys(flatItem)) this.headers.add(key);

		this.push(transformed);
		callback();
	}
}
