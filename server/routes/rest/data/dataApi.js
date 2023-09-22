import moment from 'moment';

import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import isDate from 'lodash/isDate';
import isArray from 'lodash/isArray';
import first from 'lodash/first';

import { flatten } from 'flat';
import { Workbook } from 'excel4node';

import { app } from '/server/lib/routes/app';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { Meta, MetaObjectCollection } from '/imports/model/MetaObject';

import { find, saveLead, getNextUserFromQueue, findById, findByLookup, create, update, deleteData, relationCreate, historyFind } from '/imports/data/data';

import { getAccessFor } from '/imports/utils/accessUtils';
import { getUserSafe } from '/imports/auth/getUser';
import { errorReturn } from '/imports/utils/return';

app.post('/rest/data/lead/save', async function (req, res) {
	const authTokenId = getAuthTokenIdFromReq(req);
	const lead = req.body.lead;
	const save = req.body.save;
	const result = await saveLead({
		authTokenId,
		lead,
		save,
	});
	res.send(result);
});

app.get('/rest/data/:document/find', async function (req, res) {
	if (req.params.query.filter != null && isString(req.params.query.filter)) {
		req.params.query.filter = JSON.parse(req.params.query.filter);
	}

	const result = await find({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		displayName: req.params.query.displayName,
		displayType: req.params.query.displayType,
		fields: req.params.query.fields,
		filter: req.params.query.filter,
		sort: req.params.query.sort,
		limit: req.params.query.limit,
		start: req.params.query.start,
		withDetailFields: req.params.query.withDetailFields,
		getTotal: true,
	});
	res.send(result);
});

app.post('/rest/data/:document/find', async function (req, res) {
	if (isObject(req.body)) {
		req.params.query.filter = req.body;
	}

	const result = await find({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		displayName: req.params.query.displayName,
		displayType: req.params.query.displayType,
		fields: req.params.query.fields,
		filter: req.params.query.filter,
		sort: req.params.query.sort,
		limit: req.params.query.limit,
		start: req.params.query.start,
		withDetailFields: req.params.query.withDetailFields,
		getTotal: true,
	});
	res.send(result);
});

app.get('/rest/data/:document/queue/next/:queueId', async function (req, res) {
	const result = await getNextUserFromQueue({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		queueId: req.params.queueId,
	});

	res.send(result);
});

app.get('/rest/data/:document/:dataId', async function (req, res) {
	const result = await findById({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		fields: req.params.query.fields,
		dataId: req.params.dataId,
		withDetailFields: req.params.query.withDetailFields,
	});

	res.send(result);
});

app.get('/rest/data/:document/lookup/:field', async function (req, res) {
	const extraFilter = isString(req.params.query.filter) ? JSON.parse(req.params.query.filter) : undefined;

	const result = await findByLookup({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		field: req.params.field,
		search: req.params.query.search,
		extraFilter,
		start: req.params.query.start,
		limit: req.params.query.limit,
		useChangeUserFilter: req.params.query.useChangeUserFilter === 'true',
	});

	res.send(result);
});

app.post('/rest/data/:document', async function (req, res) {
	const result = await create({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: req.body,
	});

	res.send(result);
});

app.put('/rest/data/:document', async function (req, res) {
	const result = await update({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: req.body,
	});

	res.send(result);
});

app.del('/rest/data/:document', async function (req, res) {
	const result = await deleteData({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: req.body,
	});

	res.send(result);
});

app.post('/rest/data/:document/relations/:fieldName', async function (req, res) {
	const result = await relationCreate({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		fieldName: req.params.fieldName,
		data: req.body,
	});

	res.send(result);
});

app.post('/rest/data/:document/relations/:fieldName/preview', async function (req, res) {
	const result = await relationCreate({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		fieldName: req.params.fieldName,
		data: req.body,
		preview: true,
	});

	res.send(result);
});

app.get('/rest/data/:document/:dataId/history', async function (req, res) {
	const result = await historyFind({
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		dataId: req.params.dataId,
		fields: req.params.query.fields,
	});

	res.send(result);
});

// PAREI AQUI

/* @Export_CSV */
const csvExport = function (headers, data, name, res) {
	// Define separator, sufix and prefix
	const separator = '","';
	const prefix = '"';
	const sufix = '"';

	// Send headers with content type and file name
	res.writeHead(200, {
		'Content-Type': 'application/csv',
		'Content-Disposition': `attachment; filename=${name}.csv`,
	});

	// Iterate over keys to send header line
	let header = headers.join(separator);

	if (header !== '') {
		header = prefix + header + sufix;
	}

	// Send header
	res.write(header + '\n');

	// Iterate over data
	for (let item of data) {
		let value = [];
		// And iterate over keys to get value or empty
		for (let key of headers) {
			const v = item[key];
			// If no value then send empty string
			value.push(v || '');
		}

		value = value.join(separator);

		if (value !== '') {
			value = prefix + value + sufix;
		}

		// Send each line
		res.write(value + '\n');
	}

	// End request
	res.end();
};

/* @Export_XLS */
const xlsExport = function (headers, data, name, res) {
	let header, index;
	const wb = new Workbook();
	wb.debug = false;

	const headerStyle = wb.createStyle({
		font: {
			bold: true,
		},
		fill: {
			type: 'pattern',
			patternType: 'solid',
			fgColor: '#F2F2F2',
		},
	});

	const ws = wb.addWorksheet(name);

	const widths = {};

	for (index = 0; index < headers.length; index++) {
		header = headers[index];
		ws.cell(1, index + 1)
			.string(header)
			.style(headerStyle);
		widths[index] = String(header).length * 1.1;
	}

	for (let lineIndex = 0; lineIndex < data.length; lineIndex++) {
		const item = data[lineIndex];
		for (index = 0; index < headers.length; index++) {
			header = headers[index];
			let value = item[header] || '';

			if (isDate(value)) {
				value = moment(value).format('DD/MM/YYYY HH:mm:ss');
			}

			const width = String(value).length * 1.1;
			if (widths[index] < width) {
				widths[index] = width;
			}

			//Any objects add on cell it's a critical error for excel4node
			if (typeof value === 'object') {
				value = '';
			}

			ws.cell(lineIndex + 2, index + 1).string('' + value);
		}
	}

	for (index = 0; index < headers.length; index++) {
		header = headers[index];
		ws.column(index + 1).setWidth(widths[index]);
	}

	return wb.write(`${name}.xlsx`, res);
};

/* @Export */
app.get('/rest/data/:document/list/:listName/:type', async function (req, res) {
	const authTokenId = getAuthTokenIdFromReq(req);
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return errorReturn(errors);
	}

	const { document, listName, type } = req.params;

	const access = getAccessFor(document, user);
	if (access === false || access.isReadable !== true) {
		return errorReturn(`[${document}] You don't have permission to read records`);
	}

	if (['csv', 'xls'].includes(type) === false) {
		return errorReturn(`[${document}] Value for type must be one of [csv, xls]`);
	}

	const listMeta = await MetaObjectCollection.findOne({
		type: 'list',
		document,
		name: listName,
	});

	if (listMeta == null) {
		return errorReturn(`[${document}] Can't find meta for list ${listName} of document ${document}`);
	}

	const metaObject = Meta[document];

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

	if (isString(req.params.query.filter) === false && isObject(listMeta.filter)) {
		req.params.query.filter = JSON.stringify(listMeta.filter);
	}

	if (isString(req.params.query.sort) === false && isArray(listMeta.sorters)) {
		req.params.query.sort = JSON.stringify(listMeta.sorters);
	}

	const getFields = () => {
		if (isString(req.params.query.fields)) {
			return req.params.query.fields;
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

	const filter = isString(req.params.query.filter) ? JSON.parse(req.params.query.filter) : undefined;

	const result = await find({
		contextUser: user,
		document,
		displayName: req.params.query.displayName,
		displayType: req.params.query.displayType,
		fields,
		filter,
		sort: req.params.query.sort,
		limit: req.params.query.limit,
		start: req.params.query.start,
		withDetailFields: 'true',
		getTotal: true,
	});

	if (result.success === false) {
		return res.send(result);
	}

	const { flatData, keys } = result.data.reduce(
		(acc, item) => {
			const flatItem = flatten(item);
			acc.flatData.push(flatItem);
			Object.keys(flatItem).forEach(key => (acc.keys[key] = 1));
			return acc;
		},
		{ flatData: [], keys: {} },
	);

	if (type === 'xls') {
		return xlsExport(Object.keys(keys), flatData, name, res);
	} else {
		return csvExport(Object.keys(keys), flatData, name, res);
	}
});
