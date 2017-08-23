import moment from 'moment';

{flatten} = require 'flat'
xl = require 'excel4node'

app.post '/rest/data/lead/save', (req, res, next) ->
	res.send Meteor.call 'data:lead:save',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		lead: req.body.lead
		save: req.body.save

### @Find_Records ###
# Converted to method
app.get '/rest/data/:document/find', (req, res, next) ->
	if _.isString req.params.query.filter
		req.params.query.filter = JSON.parse req.params.query.filter

	res.send Meteor.call 'data:find:all',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		displayName: req.params.query.displayName
		displayType: req.params.query.displayType
		fields: req.params.query.fields
		filter: req.params.query.filter
		sort: req.params.query.sort
		limit: req.params.query.limit
		start: req.params.query.start
		withDetailFields: req.params.query.withDetailFields
		getTotal: true

# Converted to method
app.post '/rest/data/:document/find', (req, res, next) ->
	if _.isObject req.body
		req.params.query.filter = req.body

	res.send Meteor.call 'data:find:all',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		displayName: req.params.query.displayName
		displayType: req.params.query.displayType
		fields: req.params.query.fields
		filter: req.params.query.filter
		sort: req.params.query.sort
		limit: req.params.query.limit
		start: req.params.query.start
		withDetailFields: req.params.query.withDetailFields
		getTotal: true

# Converted to method
app.get '/rest/data/:document/queue/next/:queueId', (req, res, next) ->
	res.send Meteor.call 'data:queue:next',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		queueId: req.params.queueId

# Converted to method
app.get '/rest/data/:document/:dataId', (req, res, next) ->
	res.send Meteor.call 'data:find:byId',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		fields: req.params.query.fields
		dataId: req.params.dataId
		withDetailFields: req.params.query.withDetailFields

# Converted to method
app.get '/rest/data/:document/lookup/:field', (req, res, next) ->
	filter = undefined
	if _.isString req.params.query.filter
		filter = JSON.parse req.params.query.filter

	res.send Meteor.call 'data:find:byLookup',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		field: req.params.field
		search: req.params.query.search
		filter: filter
		start: req.params.query.start
		limit: req.params.query.limit
		useChangeUserFilter: req.params.query.useChangeUserFilter is 'true'


### @Create_Records ###
# Converted to method
app.post '/rest/data/:document', (req, res, next) ->
	res.send Meteor.call 'data:create',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		data: req.body


### @Update_Records ###
# Converted to method
app.put '/rest/data/:document', (req, res, next) ->
	res.send Meteor.call 'data:update',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		data: req.body


### @Delete_Records ###
# Converted to method
app.del '/rest/data/:document', (req, res, next) ->
	res.send Meteor.call 'data:delete',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		data: req.body


### @Create_Relations ###
# Converted to method
app.post '/rest/data/:document/relations/:fieldName', (req, res, next) ->
	res.send Meteor.call 'data:relation:create',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		fieldName: req.params.fieldName
		data: req.body

app.post '/rest/data/:document/relations/:fieldName/preview', (req, res, next) ->
	res.send Meteor.call 'data:relation:create',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		fieldName: req.params.fieldName
		data: req.body
		preview: true

### @History ###
# Converted to method
app.get '/rest/data/:document/:dataId/history', (req, res, next) ->
	res.send Meteor.call 'history:find',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		document: req.params.document
		dataId: req.params.dataId
		fields: req.params.query.fields


### @Export_CSV ###
csvExport = (headers, data, name, res) ->
	# Define separator, sufix and prefix
	separator = '","'
	prefix = '"'
	sufix = '"'

	# Send headers with content type and file name
	res.writeHead 200,
		'Content-Type': 'application/csv'
		'Content-Disposition': "attachment; filename=#{name}.csv"

	# Iterate over keys to send header line
	header = headers.join separator

	if header isnt ''
		header = prefix + header + sufix

	# Send header
	res.write header + '\n'

	# Iterate over data
	for item in data
		value = []
		# And iterate over keys to get value or empty
		for key in headers
			v = item[key]
			# If no value then send empty string
			value.push if v? then v else ''

		value = value.join separator

		if value isnt ''
			value = prefix + value + sufix

		# Send each line
		res.write value + '\n'

	# End request
	res.end()

### @Export_XLS ###
xlsExport = (headers, data, name, res) ->
	wb = new xl.WorkBook()
	wb.debug = false

	headerStyle = wb.Style()
	headerStyle.Font.Bold()
	headerStyle.Fill.Pattern 'solid'
	headerStyle.Fill.Color 'F2F2F2'

	ws = wb.WorkSheet name

	widths = {}

	for header, index in headers
		ws.Cell(1, index + 1).String(header).Style(headerStyle)
		widths[index] = String(header).length * 1.1

	for item, lineIndex in data
		for header, index in headers
			value = item[header] or ''

			if _.isDate value
				value = moment(value).format('DD/MM/YYYY HH:mm:ss')

			width = String(value).length * 1.1
			if widths[index] < width
				widths[index] = width

			ws.Cell(lineIndex + 2, index + 1).String value

	for header, index in headers
		ws.Column(index + 1).Width(widths[index])

	wb.write "#{name}.xlsx", res

### @Export ###
app.get '/rest/data/:document/list/:listName/:type', (req, res, next) ->
	middlewares.sessionUserAndGetAccessFor('document') req, res, ->

		# Validate param type
		if req.params.type not in ['csv', 'xls']
			return res.send new Meteor.Error 'internal-error', '[#{req.params.document}] Value for type must be one of [csv, xls]'

		if req.params.type is 'xls' and req.params.query.limit > (Namespace.exportXlsLimit || 1000)
			req.params.query.limit = (Namespace.exportXlsLimit || 1000)

		# Try to find meta of list
		listMeta = MetaObject.findOne
			type: 'list'
			document: req.params.document
			name: req.params.listName

		# If no meta found then send an error
		if not listMeta?
			return res.send new Meteor.Error 'internal-error', "[#{req.params.document}] Can't find meta for list #{req.params.listName} of document #{req.params.document}"

		# Try to get metadata
		meta = Meta[req.params.document]

		# If no meta found then send an error
		if not meta?
			return res.send new Meteor.Error 'internal-error', "[#{req.params.document}] Can't find meta"

		name = utils.getPlurals(listMeta, req.user) or utils.getLabel(listMeta, req.user)
		name ?= utils.getPlurals(meta, req.user) or utils.getLabel(meta, req.user)
		name ?= req.params.document

		# If no filter was passed use filter from meta
		if not _.isString(req.params.query.filter) and _.isObject listMeta.filter
			req.params.query.filter = JSON.stringify listMeta.filter

		# If no sort was passed use sort from meta
		if not _.isString(req.params.query.sort) and _.isArray listMeta.sorters
			req.params.query.sort = JSON.stringify listMeta.sorters

		# If no fields was passed use fields from meta
		if not _.isString(req.params.query.fields) and _.isObject listMeta.columns
			fields = []
			fields.push column.linkField for column of listMeta.columns when column.visible is true
			req.params.query.fields = fields.join(',')

		if _.isString req.params.query.filter
			req.params.query.filter = JSON.parse req.params.query.filter

		# Get results from db
		result = Meteor.call 'data:find:all',
			authTokenId: sessionUtils.getAuthTokenIdFromReq req
			document: req.params.document
			displayName: req.params.query.displayName
			displayType: req.params.query.displayType
			fields: req.params.query.fields
			filter: req.params.query.filter
			sort: req.params.query.sort
			limit: req.params.query.limit
			start: req.params.query.start
			withDetailFields: 'true'
			getTotal: true

		# If result is an erro send error
		if result instanceof Error
			req.notifyError 'Export - Error', result
			return res.send result

		# Defined array to put all flat data and object to put all keys
		flatData = []
		keys = {}

		# Iterate over data to flat all data and get keys
		for item in result.data
			flatItem = flatten item
			flatData.push flatItem
			for key of flatItem
				keys[key] = 1

		# Call function to specific type
		if req.params.type is 'xls'
			xlsExport Object.keys(keys), flatData, name, res
		else
			csvExport Object.keys(keys), flatData, name, res
