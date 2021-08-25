import { flatten } from 'flat';
import { Workbook } from 'excel4node';
import { DateTime } from 'luxon';

import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import isDate from 'lodash/isDate';
import isArray from 'lodash/isArray';

import { getAuthTokenIdFromReq } from 'utils/session';
import { getPlurals, getLabel } from 'utils';
import { Namespace, MetaObject, Meta } from 'metadata';
import { callMethod } from 'utils/methods';

import { sessionUserAndGetAccessFor } from 'server/app/middlewares';

/* @Export_CSV */
const csvExport = (headers, data, name, res) => {
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
	res.write(`${header}\n`);

	// Iterate over data
	(data ?? []).forEach(item => {
		const value = [];
		// And iterate over keys to get value or empty
		(headers ?? []).forEach(key => {
			const v = item[key];
			// If no value then send empty string
			value.push(v || '');
		});

		if (value.length > 0) {
			// Send each line
			res.write(`${prefix ?? ''}${value.join(separator)}${sufix ?? ''}\n`);
		}
	});

	// End request
	res.end();
};

/* @Export_XLS */
const xlsExport = (headers, data, name, res) => {
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

	(headers ?? []).forEach((header, index) => {
		ws.cell(1, index + 1)
			.string(header)
			.style(headerStyle);
		widths[index] = String(header).length * 1.1;
	});

	(data ?? []).forEach((item, lineIndex) => {
		(headers ?? []).forEach((header, index) => {
			const value = item[header] ?? '';
			if (isDate(value)) {
				ws.cell(lineIndex + 2, index + 1).string(`${DateTime.fromJSDate(value).toFormat('DD/MM/YYYY HH:mm:ss')}`);
			} else {
				ws.cell(lineIndex + 2, index + 1).string(`${JSON.stringify(value)}`);
			}

			const width = String(value).length * 1.1;
			if (widths[index] < width) {
				widths[index] = width;
			}
		});
	});

	Object.values(headers).forEach((width, i) => {
		ws.column(i + 1).setWidth(width);
	});

	return wb.write(`${name}.xlsx`, res);
};

export default app => {
	app.post('/api/v1/data/lead/save', async (req, res) => {
		const result = await callMethod('data:lead:save', {
			authTokenId: getAuthTokenIdFromReq(req),
			lead: req.body.lead,
			save: req.body.save,
		});
		res.send(result);
	});

	/* @Find_Records */
	// Converted to method
	app.get('/api/v1/data/:document/find', async (req, res) => {
		if (isString(req.query?.filter)) {
			req.query.filter = JSON.parse(req.query.filter);
		}

		const result = await callMethod('data:find:all', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.query.displayName,
			displayType: req.query.displayType,
			fields: req.query.fields,
			filter: req.query.filter,
			sort: req.query.sort,
			limit: req.query.limit,
			start: req.query.start,
			withDetailFields: req.query.withDetailFields,
			getTotal: true,
		});

		return res.send(result);
	});

	// Converted to method
	app.get('/api/v1/data/:document/queue/next/:queueId', async (req, res) => {
		const result = await callMethod('data:queue:next', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			queueId: req.params.queueId,
		});
		res.send(result);
	});

	// Converted to method
	app.get('/api/v1/data/:document/:dataId', async (req, res) => {
		const result = await callMethod('data:find:byId', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			fields: req.query.fields,
			dataId: req.params.dataId,
			withDetailFields: req.query.withDetailFields,
		});
		res.send(result);
	});

	// Converted to method
	app.get('/api/v1/data/:document/lookup/:field', async (req, res) => {
		let filter;
		if (isString(req.query.filter)) {
			filter = JSON.parse(req.query.filter);
		}

		const result = await callMethod('data:find:byLookup', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			field: req.params.field,
			search: req.query.search,
			filter,
			start: req.query.start,
			limit: req.query.limit,
			useChangeUserFilter: req.query.useChangeUserFilter === 'true',
		});
		return res.send(result);
	});

	/* @Create_Records */
	// Converted to method
	app.post('/api/v1/data/:document', async (req, res) => {
		const result = await callMethod('data:create', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
		});
		res.send(result);
	});

	/* @Update_Records */
	// Converted to method
	app.put('/api/v1/data/:document', async (req, res) => {
		const result = await callMethod('data:update', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
		});
		res.send(result);
	});

	/* @Delete_Records */
	// Converted to method
	app.del('/api/v1/data/:document', async (req, res) => {
		const result = await callMethod('data:delete', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: req.body,
		});
		res.send(result);
	});

	/* @Create_Relations */
	// Converted to method
	app.post('/api/v1/data/:document/relations/:fieldName', async (req, res) => {
		const result = await callMethod('data:relation:create', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			fieldName: req.params.fieldName,
			data: req.body,
		});
		res.send(result);
	});

	app.post('/api/v1/data/:document/relations/:fieldName/preview', async (req, res) => {
		const result = await callMethod('data:relation:create', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			fieldName: req.params.fieldName,
			data: req.body,
			preview: true,
		});
		res.send(result);
	});

	/* @History */
	// Converted to method
	app.get('/api/v1/data/:document/:dataId/history', async (req, res) => {
		const result = await callMethod('history:find', {
			authTokenId: getAuthTokenIdFromReq(req),
			document: req.params.document,
			dataId: req.params.dataId,
			fields: req.query.fields,
		});
		res.send(result);
	});

	/* @Export */
	app.get('/api/v1/data/:document/list/:listName/:type', (req, res) =>
		sessionUserAndGetAccessFor('document')(req, res, async () => {
			// Validate param type
			if (!['csv', 'xls'].includes(req.params.type)) {
				return res.send(new Error(`[internal-error] [${req.params.document}] Value for type must be one of [csv, xls]`));
			}

			if (req.params.type === 'xls' && req.query.limit > (Namespace.exportXlsLimit || 1000)) {
				req.query.limit = Namespace.exportXlsLimit || 1000;
			}

			// Try to find meta of list
			const listMeta = await MetaObject.findOne({
				type: 'list',
				document: req.params.document,
				name: req.params.listName,
			});

			// If no meta found then send an error
			if (!listMeta) {
				return res.send(new Error(`[internal-error] [${req.params.document}] Can't find meta for list ${req.params.listName} of document ${req.params.document}`));
			}

			// Try to get metadata
			const meta = Meta[req.params.document];

			// If no meta found then send an error
			if (!meta) {
				return res.send(new Error(`[internal-error] [${req.params.document}] Can't find meta`));
			}

			let name = getPlurals(listMeta, req.user) || getLabel(listMeta, req.user);
			if (!name) {
				name = getPlurals(meta, req.user) || getLabel(meta, req.user);
			}
			if (!name) {
				name = req.params.document;
			}

			// If no filter was passed use filter from meta
			if (!isString(req.query.filter) && isObject(listMeta.filter)) {
				req.query.filter = JSON.stringify(listMeta.filter);
			}

			// If no sort was passed use sort from meta
			if (!isString(req.query.sort) && isArray(listMeta.sorters)) {
				req.query.sort = JSON.stringify(listMeta.sorters);
			}

			// If no fields was passed use fields from meta
			if (!isString(req.query.fields) && isObject(listMeta.columns)) {
				req.query.fields = (listMeta.columns ?? []).reduce((acc, { visible, linkField }) => (visible === true ? acc.concat(linkField) : acc), []).join(',');
			}

			if (isString(req.query.filter)) {
				req.query.filter = JSON.parse(req.query.filter);
			}

			// Get results from db
			const result = await callMethod('data:find:all', {
				authTokenId: getAuthTokenIdFromReq(req),
				document: req.params.document,
				displayName: req.query.displayName,
				displayType: req.query.displayType,
				fields: req.query.fields,
				filter: req.query.filter,
				sort: req.query.sort,
				limit: req.query.limit,
				start: req.query.start,
				withDetailFields: 'true',
				getTotal: true,
			});

			// If result is an erro send error
			if (result instanceof Error) {
				req.notifyError('Export - Error', result);
				return res.send(result);
			}

			if (!result.success) {
				return res.send(result.errors[0].message);
			}

			// Defined array to put all flat data and object to put all keys
			const flatData = [];
			const keys = {};

			// Iterate over data to flat all data and get keys
			(result?.data ?? []).forEach(item => {
				const flatItem = flatten(item);
				flatData.push(flatItem);
				Object.keys(flatItem).forEach(key => (keys[key] = 1));
			});

			// Call function to specific type
			if (req.params.type === 'xls') {
				return xlsExport(Object.keys(keys), flatData, name, res);
			}
			return csvExport(Object.keys(keys), flatData, name, res);
		}),
	);
};
