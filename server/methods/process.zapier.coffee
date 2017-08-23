findOpportunity = (search) ->
	if not search
		return null

	if search?._id?
		filter =
			term: '_id'
			operator: 'equals'
			value: search._id

	if search?.rawMessageId?
		filter =
			term: 'rawMessageId'
			operator: 'equals'
			value: search.rawMessageId

	if search?.contactId?
		filter =
			term: 'contact._id'
			operator: 'equals'
			value: search.contactId

	if not filter
		return null

	record = Meteor.call 'data:find:all',
		document: 'Opportunity'
		filter:
			conditions: [ filter ]
		fields: '_id, _updatedAt, contact, rawMessageId, status'

	if record?.data?[0]?._id?
		return record.data[0]

findContactsByEmails = (emails) ->
	if !_.isArray emails
		return null

	filter =
		term: 'email.address'
		operator: 'in'
		value: emails.map((email) -> email.toLowerCase())

	record = Meteor.call 'data:find:all',
		document: 'Contact'
		filter:
			conditions: [ filter ]
		fields: '_id, email'

	if record?.data?.length > 0
		return record.data

	return []

findUsersByEmails = (emails) ->
	if !_.isArray emails
		return null

	filter =
		term: 'emails.address'
		operator: 'in'
		value: emails.map((email) -> email.toLowerCase())

	record = Meteor.call 'data:find:all',
		document: 'User'
		filter:
			conditions: [ filter ]
		fields: '_id, emails'

	if record?.data?.length > 0
		return record.data

	return []

### Process Zapier
	@param authTokenId
	@param data
###
Meteor.registerMethod 'process:zapier', 'withUser', (request) ->
	console.log '[ZAPIER] ->'.blue, request.data.message_id

	cheerio = require 'cheerio'

	response =
		success: true
		errors: []

	metas = {}
	if request.data.body_html
		$ = cheerio.load(request.data.body_html)
		$('meta').each((i, elem) -> metas[elem.attribs.name] = elem.attribs.content)

	# check request.data
	# 	sender: String
	# 	text: String
	# 	headers: Match.Maybe(String)
	# 	references: Match.Maybe(String)
	# 	reply_to: Match.Maybe(String)
	# 	date: String
	# 	message_id: String
	# 	subject: String

	console.log '[ZAPIER] Metas ->'.blue, metas

	if metas['opportunity:_id'] && request.data.message_id?
		opportunity = findOpportunity { _id: metas['opportunity:_id'] }
		console.log '[ZAPIER] opportunity ->'.blue, opportunity
		if opportunity and not opportunity.rawMessageId
			updateRequest =
				document: 'Opportunity'
				data:
					ids: [ { _id: opportunity._id, _updatedAt: $date: opportunity._updatedAt.toISOString() } ]
					data: {
						rawMessageId: request.data.message_id
					}

			result = Meteor.call 'data:update', updateRequest
			if _.isArray result.errors
				response.errors = response.errors.concat result.errors

			if result.success is false
				response.success = false

			# If we are updating the opportunity, then first message exists already
			return response

	mainContact = opportunity?.contact

	if !opportunity
		if request.data.references
			references = request.data.references.split(' ')
			for reference in references
				opportunity = findOpportunity { rawMessageId: reference }
				if opportunity
					if opportunity.contact
						mainContact = opportunity.contact
					break

	console.log '[ZAPIER] from email'.blue, request.data.from_email
	console.log '[ZAPIER] to email'.blue, request.data.to
	fromDomain = false
	if Namespace.domain and request.data.from_email and request.data.from_email.indexOf(Namespace.domain) isnt -1 and request.data.to.indexOf(request.data.from_email) is -1
		fromDomain = true

	console.log '[ZAPIER] fromDomain'.blue, fromDomain

	emails = []
	if request.data.from_email
		emails = emails.concat request.data.from_email
	if request.data.cc
		emails = emails.concat request.data.cc.split(',')
	if request.data.to
		emails = emails.concat request.data.to.split(',')

	rfcMailPatternWithName = /^(?:(.*)<)?([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)(?:>?)$/
	emails = _.compact(_.map(emails, (email) -> matches = email.match(rfcMailPatternWithName); if matches then { name: matches[1], address: matches[2] }))
	console.log '[ZAPIER] emails ->'.blue, emails

	users = findUsersByEmails(_.pluck(emails, 'address'))

	if Namespace.domain
		contactEmails = _.filter(_.pluck(emails, 'address'), (email) -> return email.indexOf(Namespace.domain) is -1);
	else
		contactEmails = _.pluck(emails, 'address')

	console.log '[ZAPIER] contact emails ->'.blue, contactEmails
	contacts = findContactsByEmails(contactEmails)

	console.log '[ZAPIER] users ->'.blue, users
	console.log '[ZAPIER] contacts ->'.blue, contacts

	notFound = []
	for email in emails when email.address.indexOf('zapiermail.com') is -1 and (!Namespace.domain or email.address.indexOf(Namespace.domain) is -1)
		if !_.find(users, (user) -> _.findWhere(user.emails, { address: email.address })) and !_.find(contacts, (user) -> _.findWhere(user.email, { address: email.address })) and !_.find(notFound, (user) -> { address: email.address })
			notFound.push email

	if not opportunity and contacts.length > 0
		for contact in contacts
			opportunity = findOpportunity { contactId: contact._id }
			if opportunity
				mainContact = opportunity.contact
				break

	for email in notFound
		createContact =
			document: 'Contact'
			data:
				status: 'Lead'
				name: { first: email.name or email.address }
				email: [ { address: email.address } ]

		if mainContact
			createContact.data.mainContact = { _id: mainContact._id }
		else if contacts.length > 0
			createContact.data.mainContact = contacts[0]

		if users.length > 0
			createContact.data._user = users

		result = Meteor.call 'data:create', createContact
		if result.success is true and result.data?[0]?._id
			contacts.push { _id: result.data[0]._id }

	console.log '[ZAPIER] opportunity ->'.blue, opportunity
	if opportunity and opportunity.status in ['New', 'Invalid', 'Lost'] and fromDomain
		updateRequest =
			document: 'Opportunity'
			data:
				ids: [ { _id: opportunity._id, _updatedAt: $date: opportunity._updatedAt.toISOString() } ]
				data: {
					status: 'Validating'
				}

		result = Meteor.call 'data:update', updateRequest
		console.log '[ZAPIER] update opportunity status ->'.blue, opportunity.status, updateRequest.data.data.status

		if _.isArray result.errors
			response.errors = response.errors.concat result.errors
			response.success = false
			return response

	if not opportunity and contacts.length > 0
		createOpportunity =
			document: 'Opportunity'
			data:
				contact: contacts[0]
				label: request.data.subject
				description: request.data.body_html

		result = Meteor.call 'data:create', createOpportunity
		if result.success is true and result.data?[0]?._id
			opportunity = { _id: result.data[0]._id }

		console.log '[ZAPIER] createOpportunity'.blue

	if opportunity or contacts.length > 0
		createMessage =
			document: 'Message'
			data:
				status: if fromDomain then 'Enviada' else 'Recebida'
				type: 'Email'
				subject: request.data.subject
				from: request.data.from
				to: request.data.to
				cc: request.data.cc
				body: request.data.body_html

		if contacts.length > 0
			createMessage.data.contact = contacts

		if users.length > 0
			createMessage.data._user = users

		if opportunity
			createMessage.data.opportunity = opportunity

		result = Meteor.call 'data:create', createMessage
		if _.isArray result.errors
			response.errors = response.errors.concat result.errors

		if result.success is false
			response.success = false

		console.log '[ZAPIER] createMessage ->'.blue, result

	if response.errors.length is 0
		delete response.errors

	return response
