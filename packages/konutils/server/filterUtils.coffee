crypto = require 'crypto'

###
rest/data/OK Activity/find
	&fields=_user,_updatedAt,code
	TODO &filter={"match":"and","conditions":[]}
	&start=0
	&limit=1000
	&sort=[{"property":"_createdAt","direction":"DESC"}]
###

validOperators = [
	'equals'
	'not_equals'
	'starts_with'
	'end_with'
	'contains'
	'not_contains'
	'less_than'
	'greater_than'
	'less_or_equals'
	'greater_or_equals'
	'between'
	'current_user'
	'not_current_user'
	'current_user_group'
	'not_current_user_group'
	'current_user_groups'
	'in'
	'not_in'
	'exists'
]

operatoresByType =
	'text'              : ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with']
	'url'               : ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with']
	'email.address'     : ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with']
	'number'            : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	'autoNumber'        : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	'date'              : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	'dateTime'          : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	#TODO 'time'        : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	'money.currency'    : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	'money.value'       : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	'boolean'           : ['exists', 'equals', 'not_equals']
	'address.country'   : ['exists', 'equals', 'not_equals']
	'address.city'      : ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with']
	'address.state'     : ['exists', 'equals', 'not_equals', 'in', 'not_in']
	'address.district'  : ['exists', 'equals', 'not_equals', 'in', 'not_in']
	'address.place'     : ['exists', 'equals', 'not_equals',                  'contains']
	'address.number'    : ['exists', 'equals', 'not_equals']
	'address.postalCode': ['exists', 'equals', 'not_equals',                  'contains']
	'address.complement': ['exists', 'equals', 'not_equals',                  'contains']
	'personName.first'  : ['exists', 'equals', 'not_equals',                  'contains', 'not_contains', 'starts_with', 'end_with']
	'personName.last'   : ['exists', 'equals', 'not_equals',                  'contains', 'not_contains', 'starts_with', 'end_with']
	'personName.full'   : ['exists', 'equals', 'not_equals',                  'contains', 'not_contains', 'starts_with', 'end_with']
	'phone.phoneNumber' : ['exists', 'equals', 'not_equals', 'in', 'not_in',  'contains', 'not_contains', 'starts_with', 'end_with']
	'phone.countryCode' : ['exists', 'equals', 'not_equals', 'in', 'not_in']
	'picklist'          : ['exists', 'equals', 'not_equals', 'in', 'not_in']
	#TODO 'json':
	#TODO improve lookup
	'lookup'            : ['exists']
	'lookup._id'        : ['exists', 'equals', 'not_equals', 'in', 'not_in']
	'ObjectId'          : ['exists', 'equals', 'not_equals', 'in', 'not_in']
	#TODO 'inherit_lookup':
	'encrypted'         : ['exists', 'equals', 'not_equals']
	#TODO improve filter
	'filter'            : ['exists']
	'filter.conditions' : ['exists']
	'richText'          : ['exists',					  'contains']
	'file'              : ['exists']
	'percentage'        : ['exists', 'equals', 'not_equals',									'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']

filterUtils = {}

filterUtils.parseConditionValue = (condition, field, req, subTermPart) ->
	if field.type is 'lookup' and subTermPart isnt '._id' and subTermPart.indexOf('.') isnt -1
		meta = Meta[field.document]
		if not meta?
			e = new Meteor.Error 'utils-internal-error', "Meta #{field.document} of field #{field.name} not found"
			NotifyErrors.notify 'FilterError', e
			return e

		subTermPart = subTermPart.split '.'
		subTermPart.shift()

		lookupField = meta.fields[subTermPart.shift()]

		if subTermPart.length > 0
			subTermPart = '.' + subTermPart.join('.')
		else
			subTermPart = ''

		return filterUtils.parseConditionValue condition, lookupField, req, subTermPart

	switch condition.value
		when '$user'
			return req.user._id
		when '$group'
			return req.user.group?._id
		when '$groups'
			groups = []
			if req.user.groups? and _.isArray req.user.groups
				groups.push group._id for group in req.user.groups
			return groups
		when '$allgroups'
			groups = []

			if req.user.group?._id?
				groups.push req.user.group._id

			if req.user.groups? and _.isArray req.user.groups
				groups.push group._id for group in req.user.groups
			return groups
		when '$now'
			return new Date()

	if /^\$user\..+/.test condition.value
		return utils.getObjectPathAgg req.user, condition.value.replace('$user.', '')

	if subTermPart is '._id' and _.isString(condition.value)
		return condition.value

	switch field.type
		when 'Number'
			return parseInt condition.value
		when 'encrypted'
			return crypto.createHash('md5').update(condition.value).digest 'hex'
		else
			return condition.value

filterUtils.validateOperator = (condition, field, subTermPart) ->
	if field.type is 'lookup' and subTermPart isnt '._id' and subTermPart.indexOf('.') isnt -1
		meta = Meta[field.document]
		if not meta?
			e = new Meteor.Error 'utils-internal-error', "Meta #{field.document} of field #{field.name} not found"
			NotifyErrors.notify 'FilterError', e
			return e

		subTermPart = subTermPart.split '.'
		subTermPart.shift()

		lookupField = meta.fields[subTermPart.shift()]

		if subTermPart.length > 0
			subTermPart = '.' + subTermPart.join('.')
		else
			subTermPart = ''

		return filterUtils.validateOperator condition, lookupField, subTermPart

	type = field.type + subTermPart
	if not operatoresByType[type]?
		e = new Meteor.Error 'utils-internal-error', "Field type [#{type}] of [#{field.name}] not supported to filter"
		NotifyErrors.notify 'FilterError', e, {condition: condition, field: field}
		return e

	if operatoresByType[type].indexOf(condition.operator) is -1
		e = new Meteor.Error 'utils-internal-error', "Field [#{condition.term}] only supports operators [#{operatoresByType[type].join(', ')}]. Trying to use operator [#{condition.operator}]"
		NotifyErrors.notify 'FilterError', e, {condition: condition}
		return e

	return true

filterUtils.parseFilterCondition = (condition, metaObject, req, invert) ->
	if not _.isString(condition.term) or validOperators.indexOf(condition.operator) is -1 or not condition.value?
		return new Meteor.Error 'utils-internal-error', 'All conditions must contain term, operator and value'

	# Allow compatibility with old filters containing .data in isList fields
	condition.term = condition.term.replace '.data', ''

	termParts = condition.term.split('.')
	subTermPart = condition.term.split('.')
	subTermPart.shift()
	subTermPart = subTermPart.join('.')
	if subTermPart.length > 0
		subTermPart = '.' + subTermPart
	field = metaObject.fields[termParts[0]]

	if termParts[0] is '_id'
		field =
			type: 'ObjectId'

	if not field?
		return new Meteor.Error 'utils-internal-error', "Field [#{condition.term}] does not exists at [#{metaObject._id}]"

	result = filterUtils.validateOperator condition, field, subTermPart
	if result instanceof Error
		return result

	value = filterUtils.parseConditionValue condition, field, req, subTermPart
	if value instanceof Error
		return value

	queryCondition = {}

	type = field.type + subTermPart

	processValueByType = (value) ->
		switch type
			when 'ObjectId'
				if _.isString(value)
					value = value
			when 'date', 'dateTime'
				if _.isObject(value) and _.isString(value.$date)
					value = new Date value.$date
			when 'phone.countryCode'
				if _.isString value
					value = parseInt value
			when 'money.currency'
				if condition.operator not in ['not_equals', 'exists']
					condition.operator = 'equals'
		return value


	if condition.operator is 'between'
		if _.isObject(value)
			if _.isObject(value.greater_or_equals) and _.isString(value.greater_or_equals.$date)
				value.greater_or_equals = processValueByType value.greater_or_equals

			if _.isObject(value.less_or_equals) and _.isString(value.less_or_equals.$date)
				value.less_or_equals = processValueByType value.less_or_equals

	else
		value = processValueByType value

	switch condition.operator
		when 'equals'
			queryCondition[condition.term] = value
			if invert is true
				invert = false
				queryCondition[condition.term] = $ne: queryCondition[condition.term]
		when 'not_equals'
			queryCondition[condition.term] = $ne: value
		when 'contains'
			queryCondition[condition.term] = $regex: value, $options: 'i'
		when 'not_contains'
			queryCondition[condition.term] = $not: {$regex: value, $options: 'i'}
		when 'starts_with'
			queryCondition[condition.term] = {$regex: '^' + value, $options: 'i'}
		when 'end_with'
			queryCondition[condition.term] = {$regex: value + '$', $options: 'i'}
		when 'in'
			queryCondition[condition.term] = $in: value
		when 'not_in'
			queryCondition[condition.term] = $nin: value
		when 'greater_than'
			queryCondition[condition.term] = $gt: value
		when 'greater_or_equals'
			queryCondition[condition.term] = $gte: value
		when 'less_than'
			queryCondition[condition.term] = $lt: value
		when 'less_or_equals'
			queryCondition[condition.term] = $lte: value
		when 'between'
			queryCondition[condition.term] = {}
			if value.greater_or_equals?
				queryCondition[condition.term].$gte = value.greater_or_equals
			if value.less_or_equals?
				queryCondition[condition.term].$lte = value.less_or_equals
		when 'exists'
			queryCondition[condition.term] = $exists: value
		else
			e = new Meteor.Error 'utils-internal-error', "Operator [#{condition.operator}] not supported"
			NotifyErrors.notify 'FilterError', e, {condition: condition}
			return e

	if invert is true
		queryCondition[condition.term] = $not: queryCondition[condition.term]

	return queryCondition

filterUtils.parseFilterObject = (filter, metaObject, req) ->
	query = []

	if _.isArray(filter.filters) and filter.filters.length > 0
		for subFilter in filter.filters
			result = filterUtils.parseFilterObject subFilter, metaObject, req
			if result instanceof Error
				console.log result
				return result
			query.push result

	if _.isArray(filter.conditions) and filter.conditions.length > 0
		for condition in filter.conditions
			if condition.disabled isnt true
				result = filterUtils.parseFilterCondition condition, metaObject, req
				if result instanceof Error
					console.log result
					return result
				query.push result

	else if _.isObject(filter.conditions) and Object.keys(filter.conditions).length > 0
		for key, condition of filter.conditions
			if condition.disabled isnt true
				result = filterUtils.parseFilterCondition condition, metaObject, req
				if result instanceof Error
					console.log result
					return result
				query.push result

	if query.length is 0
		return {}

	if query.length is 1
		return query[0]

	if filter.match is 'or'
		return $or: query

	return $and: query

filterUtils.parseDynamicData = (filter, keyword, data) ->
	if filter?.filter?
		filterUtils.parseDynamicData filter.filter, keyword, data
		return filter

	if _.isArray(filter.filters) and filter.filters.length > 0
		for subFilter in filter.filters
			return filterUtils.parseDynamicData subFilter, keyword, data

	parseConditions = (condition) ->
		if condition?.value?.indexOf(keyword) isnt -1
			condition.value = utils.getObjectPathAgg(data, condition.value.replace(keyword + '.', ''))

	if _.isArray(filter.conditions) and filter.conditions.length > 0
		for condition in filter.conditions
			if condition.disabled isnt true
				parseConditions condition

	else if _.isObject(filter.conditions) and Object.keys(filter.conditions).length > 0
		for key, condition of filter.conditions
			if condition.disabled isnt true
				parseConditions condition

	return filter
