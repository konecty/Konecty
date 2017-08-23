
### @Add_File ###
app.post '/rest/file2/:document/:recordCode/:fieldName', (req, res, next) ->
	middlewares.sessionUserAndGetAccessFor('document') req, res, ->
		# Get meta of document
		meta = Meta[req.params.document]

		if not meta?
			return res.send new Meteor.Error 'internal-error', "Meta [#{req.params.document}] does not exists"

		# Try to get passed field
		field = meta.fields[req.params.fieldName]
		if not field?
			return res.send new Meteor.Error 'internal-error', "Field [#{req.params.fieldName}] does not exists on metadata [#{req.params.document}]"

		# Verify if field is of type file
		if field.type isnt 'file'
			return res.send new Meteor.Error 'internal-error', "Field [#{req.params.fieldName}] must be of type file"

		# Get model of document
		model = Models[req.params.document]

		# Find record by code or id
		record = model.findOne $or: [
			{code: parseInt req.params.recordCode}
			{_id: req.params.recordCode}
		]

		# If no record found then return error
		if not record?
			return res.send new Meteor.Error 'internal-error', "Record with code or id [#{req.params.recordCode}] was not found"

		# Add file if is isList or change file if is single
		if field.isList is true
			record[field.name] ?= []
			f = record[field.name].filter (item) ->
				return item.etag is req.body.etag and item.key is req.body.key

			if f.length is 0
				record[field.name].push req.body
		else
			record[field.name] = req.body

		# Define data to update to send to updateRecords Api
		dataToUpdate =
			ids: [{
				_id: record._id
				_updatedAt:
					$date: record._updatedAt.toISOString()
			}]
			data: {}

		# Add field of file
		dataToUpdate.data[field.name] = record[field.name]

		# Define body with data to preocess update
		body = dataToUpdate

		# Execute update
		result = Meteor.call 'data:update',
			authTokenId: sessionUtils.getAuthTokenIdFromReq req
			document: req.params.document
			data: body

		# If resuls is an error, return
		if result instanceof Error
			return res.send result

		# If resuls is success: false or data don't have records, return
		if result.success is false or result.data.length isnt 1
			return res.send result

		# Else send result
		res.send result.data[0]

### @Remove_File ###
app.del '/rest/file2/:document/:recordCode/:fieldName/:fileName', (req, res, next) ->
	middlewares.sessionUserAndGetAccessFor('document') req, res, ->
		# Get meta of document
		meta = Meta[req.params.document]

		if not meta?
			return res.send new Meteor.Error 'internal-error', "Meta [#{req.params.document}] does not exists"

		# Try to get passed field
		field = meta.fields[req.params.fieldName]
		if not field?
			return res.send new Meteor.Error 'internal-error', "Field [#{req.params.fieldName}] does not exists on metadata [#{req.params.document}]"

		# Verify if field is of type file
		if field.type isnt 'file'
			return res.send new Meteor.Error 'internal-error', "Field [#{req.params.fieldName}] must be of type file"

		# Get model of document
		model = Models[req.params.document]

		# Find record by code or id
		record = model.findOne $or: [
			{code: parseInt req.params.recordCode}
			{_id: req.params.recordCode}
		]

		# If no record found then return error
		if not record?
			return res.send new Meteor.Error 'internal-error', "Record with code or id [#{req.params.recordCode}] was not found"

		# Add file if is isList or change file if is single
		if field.isList is true
			record[field.name] ?= []
			index = _.indexBy record[field.name], (i) ->
				i.name is req.params.fileName

			if index is -1
				return res.send new Meteor.Error 'internal-error', "File with name [#{req.params.fileName}] was not found"

			record[field.name].splice index, 1
		else
			record[field.name] = null

		# Define data to update to send to updateRecords Api
		dataToUpdate =
			ids: [{
				_id: record._id
				_updatedAt:
					$date: record._updatedAt.toISOString()
			}]
			data: {}

		# Add field of file
		dataToUpdate.data[field.name] = record[field.name]

		# Define body with data to preocess update
		body = dataToUpdate

		# Execute update
		result = Meteor.call 'data:update',
			authTokenId: sessionUtils.getAuthTokenIdFromReq req
			document: req.params.document
			data: body

		# If resuls is an error, return
		if result instanceof Error
			return res.send result

		# If resuls is success: false or data don't have records, return
		if result.success is false or not result.data? or result.data?.length isnt 1
			return res.send result

		# Else send result
		res.send result.data[0]
