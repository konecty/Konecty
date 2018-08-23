/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import moment from 'moment';

const {flatten} = require('flat');
const xl = require('excel4node');

app.post('/rest/data/lead/save', (req, res, next) =>
	res.send(Meteor.call('data:lead:save', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		lead: req.body.lead,
		save: req.body.save
	}
	)
	)
);

/* @Find_Records */
// Converted to method
app.get('/rest/data/:document/find', function(req, res, next) {
	if (_.isString(req.params.query.filter)) {
		req.params.query.filter = JSON.parse(req.params.query.filter);
	}

	return res.send(Meteor.call('data:find:all', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		displayName: req.params.query.displayName,
		displayType: req.params.query.displayType,
		fields: req.params.query.fields,
		filter: req.params.query.filter,
		sort: req.params.query.sort,
		limit: req.params.query.limit,
		start: req.params.query.start,
		withDetailFields: req.params.query.withDetailFields,
		getTotal: true
	}
	)
	);
});

// Converted to method
app.post('/rest/data/:document/find', function(req, res, next) {
	if (_.isObject(req.body)) {
		req.params.query.filter = req.body;
	}

	return res.send(Meteor.call('data:find:all', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		displayName: req.params.query.displayName,
		displayType: req.params.query.displayType,
		fields: req.params.query.fields,
		filter: req.params.query.filter,
		sort: req.params.query.sort,
		limit: req.params.query.limit,
		start: req.params.query.start,
		withDetailFields: req.params.query.withDetailFields,
		getTotal: true
	}
	)
	);
});

// Converted to method
app.get('/rest/data/:document/queue/next/:queueId', (req, res, next) =>
	res.send(Meteor.call('data:queue:next', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		queueId: req.params.queueId
	}
	)
	)
);

// Converted to method
app.get('/rest/data/:document/:dataId', (req, res, next) =>
	res.send(Meteor.call('data:find:byId', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		fields: req.params.query.fields,
		dataId: req.params.dataId,
		withDetailFields: req.params.query.withDetailFields
	}
	)
	)
);

// Converted to method
app.get('/rest/data/:document/lookup/:field', function(req, res, next) {
	let filter = undefined;
	if (_.isString(req.params.query.filter)) {
		filter = JSON.parse(req.params.query.filter);
	}

	return res.send(Meteor.call('data:find:byLookup', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		field: req.params.field,
		search: req.params.query.search,
		filter,
		start: req.params.query.start,
		limit: req.params.query.limit,
		useChangeUserFilter: req.params.query.useChangeUserFilter === 'true'
	}
	)
	);
});


/* @Create_Records */
// Converted to method
app.post('/rest/data/:document', (req, res, next) =>
	res.send(Meteor.call('data:create', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: req.body
	}
	)
	)
);


/* @Update_Records */
// Converted to method
app.put('/rest/data/:document', (req, res, next) =>
	res.send(Meteor.call('data:update', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: req.body
	}
	)
	)
);


/* @Delete_Records */
// Converted to method
app.del('/rest/data/:document', (req, res, next) =>
	res.send(Meteor.call('data:delete', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: req.body
	}
	)
	)
);


/* @Create_Relations */
// Converted to method
app.post('/rest/data/:document/relations/:fieldName', (req, res, next) =>
	res.send(Meteor.call('data:relation:create', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		fieldName: req.params.fieldName,
		data: req.body
	}
	)
	)
);

app.post('/rest/data/:document/relations/:fieldName/preview', (req, res, next) =>
	res.send(Meteor.call('data:relation:create', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		fieldName: req.params.fieldName,
		data: req.body,
		preview: true
	}
	)
	)
);

/* @History */
// Converted to method
app.get('/rest/data/:document/:dataId/history', (req, res, next) =>
	res.send(Meteor.call('history:find', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		dataId: req.params.dataId,
		fields: req.params.query.fields
	}
	)
	)
);


/* @Export_CSV */
const csvExport = function(headers, data, name, res) {
	// Define separator, sufix and prefix
	const separator = '","';
	const prefix = '"';
	const sufix = '"';

	// Send headers with content type and file name
	res.writeHead(200, {
		'Content-Type': 'application/csv',
		'Content-Disposition': `attachment; filename=${name}.csv`
	}
	);

	// Iterate over keys to send header line
	let header = headers.join(separator);

	if (header !== '') {
		header = prefix + header + sufix;
	}

	// Send header
	res.write(header + '\n');

	// Iterate over data
	for (let item of Array.from(data)) {
		let value = [];
		// And iterate over keys to get value or empty
		for (let key of Array.from(headers)) {
			const v = item[key];
			// If no value then send empty string
			value.push((v != null) ? v : '');
		}

		value = value.join(separator);
	
		if (value !== '') {
			value = prefix + value + sufix;
		}
	
		// Send each line
		res.write(value + '\n');
	}

	// End request
	return res.end();
};

/* @Export_XLS */
const xlsExport = function(headers, data, name, res) {
	let header, index;
	const wb = new xl.WorkBook();
	wb.debug = false;

	const headerStyle = wb.Style();
	headerStyle.Font.Bold();
	headerStyle.Fill.Pattern('solid');
	headerStyle.Fill.Color('F2F2F2');

	const ws = wb.WorkSheet(name);

	const widths = {};

	for (index = 0; index < headers.length; index++) {
		header = headers[index];
		ws.Cell(1, index + 1).String(header).Style(headerStyle);
		widths[index] = String(header).length * 1.1;
	}

	for (let lineIndex = 0; lineIndex < data.length; lineIndex++) {
		const item = data[lineIndex];
		for (index = 0; index < headers.length; index++) {
			header = headers[index];
			let value = item[header] || '';

			if (_.isDate(value)) {
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
				
			ws.Cell(lineIndex + 2, index + 1).String(value);
		}
	}

	for (index = 0; index < headers.length; index++) {
		header = headers[index];
		ws.Column(index + 1).Width(widths[index]);
	}

	return wb.write(`${name}.xlsx`, res);
};

/* @Export */
app.get('/rest/data/:document/list/:listName/:type', (req, res, next) =>
	middlewares.sessionUserAndGetAccessFor('document')(req, res, function() {

		// Validate param type
		let fields;
		if (!['csv', 'xls'].includes(req.params.type)) {
			return res.send(new Meteor.Error('internal-error', '[#{req.params.document}] Value for type must be one of [csv, xls]'));
		}

		if ((req.params.type === 'xls') && (req.params.query.limit > (Namespace.exportXlsLimit || 1000))) {
			req.params.query.limit = (Namespace.exportXlsLimit || 1000);
		}

		// Try to find meta of list
		const listMeta = MetaObject.findOne({
			type: 'list',
			document: req.params.document,
			name: req.params.listName
		});

		// If no meta found then send an error
		if ((listMeta == null)) {
			return res.send(new Meteor.Error('internal-error', `[${req.params.document}] Can't find meta for list ${req.params.listName} of document ${req.params.document}`));
		}

		// Try to get metadata
		const meta = Meta[req.params.document];

		// If no meta found then send an error
		if ((meta == null)) {
			return res.send(new Meteor.Error('internal-error', `[${req.params.document}] Can't find meta`));
		}

		let name = utils.getPlurals(listMeta, req.user) || utils.getLabel(listMeta, req.user);
		if (name == null) { name = utils.getPlurals(meta, req.user) || utils.getLabel(meta, req.user); }
		if (name == null) { name = req.params.document; }

		// If no filter was passed use filter from meta
		if (!_.isString(req.params.query.filter) && _.isObject(listMeta.filter)) {
			req.params.query.filter = JSON.stringify(listMeta.filter);
		}

		// If no sort was passed use sort from meta
		if (!_.isString(req.params.query.sort) && _.isArray(listMeta.sorters)) {
			req.params.query.sort = JSON.stringify(listMeta.sorters);
		}

		// If no fields was passed use fields from meta
		if (!_.isString(req.params.query.fields) && _.isObject(listMeta.columns)) {
			fields = [];
			for (let column in listMeta.columns) { if (column.visible === true) { fields.push(column.linkField); } }
			req.params.query.fields = fields.join(',');
		}

		if (_.isString(req.params.query.filter)) {
			req.params.query.filter = JSON.parse(req.params.query.filter);
		}

		// Get results from db
		const result = Meteor.call('data:find:all', {
			authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
			document: req.params.document,
			displayName: req.params.query.displayName,
			displayType: req.params.query.displayType,
			fields: req.params.query.fields,
			filter: req.params.query.filter,
			sort: req.params.query.sort,
			limit: req.params.query.limit,
			start: req.params.query.start,
			withDetailFields: 'true',
			getTotal: true
		}
		);

		// If result is an erro send error
		if (result instanceof Error) {
			req.notifyError('Export - Error', result);
			return res.send(result);
		}

		// Defined array to put all flat data and object to put all keys
		const flatData = [];
		const keys = {};

		// Iterate over data to flat all data and get keys
		for (let item of Array.from(result.data)) {
			const flatItem = flatten(item);
			flatData.push(flatItem);
			for (let key in flatItem) {
				keys[key] = 1;
			}
		}

		// Call function to specific type
		if (req.params.type === 'xls') {
			return xlsExport(Object.keys(keys), flatData, name, res);
		} else {
			return csvExport(Object.keys(keys), flatData, name, res);
		}
	})
);
