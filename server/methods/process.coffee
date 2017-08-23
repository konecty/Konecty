import moment from 'moment';

### Process submit
	@param authTokenId
	@param data
		array de pedaços com o formato
			name: 'contact'
			data:
				name: 'john doe'
				email: 'john.doe@konecty.com' (optional, but required if not phone)
				phone: '5130303030' ou [ '5130303030', '5133303030' ] (optional, but required if not email)
				user: { username: 'username' } (optional)
				campaign: { _id: '_id' } (optional)
				queue: { _id: '_id' } (optional)
				extraFields: object (optional) -> other fields to be inserted, updated
			map: null [optional]
		,
			name: 'opportunity'
			data:
				field: value
			map:
				contact: 'contact'
		,
			name: 'product'
			data:
				field: value
			map:
				supplier: 'contact'
		,
			name: 'message'
			document: 'Message' # uses a generic method
			data:
				field: value
			map:
				contact: 'contact'
###
Meteor.registerMethod 'process:submit', 'withUser', (request) ->

	response =
		success: true
		processData: {}
		errors: []

	if not _.isArray request.data
		return new Meteor.Error 'internal-error', "Invalid payload"

	piecesReturn = {}

	request.data.some (piece) ->
		return false unless piece.name?

		params = piece.data

		options = piece.options or {}

		if piece.map?
			for field, lookup of piece.map
				lookupValue = utils.getObjectPathAgg(response.processData, lookup)
				if lookupValue?
					utils.setObjectByPath(params, field.split('.'), lookupValue)

		params['user'] = response.processData['user'] if response.processData['user']? and not params['user']?

		# console.log 'call ->'.blue, "process:#{piece.name}", params

		if Meteor.default_server.method_handlers["process:#{piece.name}"]?
			piecesReturn[piece.name] = Meteor.call "process:#{piece.name}", params, options
		else if piece.document?
			piecesReturn[piece.name] = Meteor.call "process:generic", piece.document, piece.name, params, options
		else
			response.success = false
			response.errors = [ new Meteor.Error 'process-invalid-piece', "Invalid generic piece, no document specified." ]
			return true

		# console.log 'retorno <-'.yellow, piecesReturn[piece.name]

		if piecesReturn[piece.name]?.success isnt true
			response.success = false
			response.errors = response.errors.concat piecesReturn[piece.name].errors
			return true

		response.processData = _.extend response.processData, piecesReturn[piece.name].processData

		return false

	if response.errors.length is 0
		delete response.errors

	return response

Meteor.registerMethod 'process:generic', 'withUser', (document, name, request) ->
	response =
		success: true
		processData: {}
		errors: []

	createRequest =
		document: document
		data: request

	if request.contact?._id?
		if Meta[document]?.fields['contact']?.isList?
			createRequest.data.contact = [ _id: request.contact._id ]
		else
			createRequest.data.contact = _id: request.contact._id

	createRequest.data._user = [].concat request.user if request.user

	saveResult = Meteor.call 'data:create', createRequest

	if saveResult.success isnt true
		response.success = false
		response.errors = response.errors.concat saveResult.errors
		return response

	response.processData[name] = saveResult.data[0]

	return response

Meteor.registerMethod 'process:campaignTarget', 'withUser', (request) ->
	response =
		success: true
		processData: {}
		errors: []

	if Namespace.skipCampaignTargetForActiveOpportunities is true
		record = Meteor.call 'data:find:all',
			document: 'Contact'
			filter:
				conditions: [
					term: '_id'
					operator: 'equals'
					value: request.contact._id
				,
					term: 'activeOpportunities'
					operator: 'exists'
					value: true
				]
			limit: 1

		if record?.data?.length > 0
			return response

	campaign = findCampaign request.campaign
	if campaign?
		request.campaign = campaign

	createRequest =
		document: 'CampaignTarget'
		data: request

	createRequest.data.contact = _id: request.contact._id

	createRequest.data._user = [].concat request.user if request.user

	saveResult = Meteor.call 'data:create', createRequest

	if saveResult.success isnt true
		response.success = false
		response.errors = response.errors.concat saveResult.errors
		return response

	response.processData['campaignTarget'] = saveResult.data[0]

	return response

Meteor.registerMethod 'process:opportunity', 'withUser', (request) ->
	response =
		success: true
		processData: {}
		errors: []

	record = Meteor.call 'data:find:all',
		document: 'Opportunity'
		filter:
			conditions: [
				term: 'contact._id'
				operator: 'equals'
				value: request.contact._id
			,
				term: 'status'
				operator: 'in'
				value: Namespace.activeOpportunityStatuses || [ 'Nova', 'Ofertando Imóveis', 'Em Visitação', 'Proposta', 'Contrato', 'Pré-Reserva de Lançamentos' ]
			,
				term: '_user._id'
				operator: 'equals'
				value: request.user?._id or ''
			]
		limit: 1
		sort: [
			property: '_updatedAt'
			direction: 'DESC'
		]

	# don't create an opportunity if contact already has
	if record?.data?.length > 0
		opportunity = record.data[0]
		opportunityId = record.data[0]._id
		response.processData['opportunity'] = record.data[0]
		# console.log 'oportunidade já existe'.magenta, opportunityId
		if Namespace.alertUserOnExistingOpportunity
			date = new Date()
			users = Models['User'].find({ _id: { $in: _.pluck(opportunity._user, '_id') }}).fetch()
			.forEach (user) ->
				emails = []
				_.each(user.emails, (email) ->
					emails.push (_.pick(email, 'address'))
				)
				Models['Message'].insert({
					type: 'Email',
					status: 'Send',
					email: emails,
					priority: 'Alta',
					subject: 'Nova Mensagem da Oportunidade ' + opportunity.code,
					from: 'Konecty Alerts <alerts@konecty.com>',
					body: 'Nova mensagem do cliente ' + opportunity.contact.name.full + ' (' + opportunity.contact.code + ')'
					_createdAt: date,
					_updatedAt: date,
					discard: true
				})
	else
		createRequest =
			document: 'Opportunity'
			data: {}

		# get info from product to save as interest on opportunity
		if request.product?
			if request.product._id?
				productFilter = request.product._id
			else if request.product.code?
				productFilter = { code: request.product.code }
			else if request.product.ids?
				productFilter = { _id: { $in: request.product.ids } }

			Models['Product'].find(productFilter).forEach (product) ->
				if product['inCondominium']?
					# @TODO how to decide multiple?
					createRequest.data['inCondominium'] = product['inCondominium']

				if product['zone']?
					createRequest.data['zone'] ?= []
					createRequest.data['zone'].push product['zone']

				if product['type']?
					createRequest.data['filterType'] ?= []
					createRequest.data['filterType'].push product['type']

				if product['purpose']?
					createRequest.data['filterPurpose'] ?= []
					createRequest.data['filterPurpose'] = createRequest.data['filterPurpose'].concat product['purpose']

				# if product['development']?
				# 	# @TODO how to decide multiple?
				# 	createRequest.data['development'] = product['development']

				if product['sale']?
					createRequest.data['minSale'] ?= { value: 9999999999 }
					createRequest.data['maxSale'] ?= { value: 0 }

					if product['sale'].value * 0.85 < createRequest.data['minSale'].value
						createRequest.data['minSale'] =
							currency: 'BRL'
							value: product['sale'].value * 0.85

					if product['sale'].value * 1.15 > createRequest.data['maxSale'].value
						createRequest.data['maxSale'] =
							currency: 'BRL'
							value: product['sale'].value * 1.15

				if product['areaPrivate']?
					createRequest.data['minAreaPrivate'] ?= 9999999999
					createRequest.data['maxAreaPrivate'] ?= 0

					if product['areaPrivate'] * 0.85 < createRequest.data['minAreaPrivate']
						createRequest.data['minAreaPrivate'] = product['areaPrivate'] * 0.85

					if product['areaPrivate'] * 1.15 > createRequest.data['maxAreaPrivate']
						createRequest.data['maxAreaPrivate'] = product['areaPrivate'] * 1.15

				if product['bedrooms']?
					createRequest.data['minBedrooms'] ?= 999
					createRequest.data['maxBedrooms'] ?= 0

					if product['bedrooms'] < createRequest.data['minBedrooms']
						createRequest.data['minBedrooms'] = product['bedrooms']

					if product['bedrooms'] > createRequest.data['maxBedrooms']
						createRequest.data['maxBedrooms'] = product['bedrooms']

				if product['parkingSpaces']?
					createRequest.data['minParkingSpaces'] ?= 999
					createRequest.data['maxParkingSpaces'] ?= 0

					if product['parkingSpaces'] < createRequest.data['minParkingSpaces']
						createRequest.data['minParkingSpaces'] = product['parkingSpaces']

					if product['parkingSpaces'] > createRequest.data['maxParkingSpaces']
						createRequest.data['maxParkingSpaces'] = product['parkingSpaces']

				if createRequest.data['zone']?
					createRequest.data['zone'] = _.uniq createRequest.data['zone']

				if createRequest.data['filterType']?
					createRequest.data['filterType'] = _.uniq createRequest.data['filterType']

				if createRequest.data['filterPurpose']?
					createRequest.data['filterPurpose'] = _.uniq createRequest.data['filterPurpose']

		campaign = findCampaign request.campaign
		if campaign?
			request.campaign = campaign

		source = findChannel request.source
		if source?
			request.source = source

		channel = findChannel request.channel
		if channel?
			request.channel = channel

		createRequest.data = _.extend createRequest.data, request

		createRequest.data.contact = _id: request.contact._id

		createRequest.data._user = [].concat request.user if request.user

		# console.log 'opportunity ->'.green, JSON.stringify createRequest, null, '  '

		saveResult = Meteor.call 'data:create', createRequest

		if saveResult.success isnt true
			response.success = false
			response.errors = response.errors.concat saveResult.errors
			return response

		response.processData['opportunity'] = saveResult.data[0]

		opportunityId = saveResult.data[0]._id

	if request.product?
		if request.product._id?
			productsList = [ request.product._id ]
		else if request.product.code?
			record = Meteor.call 'data:find:all',
				document: 'Product'
				filter:
					conditions: [
						term: 'code'
						operator: 'equals'
						value: request.product.code
					]
				limit: 1
				fields: '_id'

			# console.log 'record ->'.red,request.product.code,record

			# don't create an opportunity if concat already has
			if record?.data?.length > 0
				productsList = [ record.data[0]._id ]
		else if request.product.ids?
			productsList = request.product.ids

		# console.log 'productsList ->'.yellow, productsList

		if productsList
			productsList.forEach (productId) ->
				record = Meteor.call 'data:find:all',
					document: 'ProductsPerOpportunities'
					filter:
						conditions: [
							term: 'product._id'
							operator: 'equals'
							value: productId
						,
							term: 'contact._id'
							operator: 'equals'
							value: request.contact._id
						]
					limit: 1
					fields: '_id'

				# console.log 'record ->'.red,request.product.code,record

				# don't create an opportunity if concat already has
				if record?.data?.length is 0
					createRequest =
						document: 'ProductsPerOpportunities'
						data:
							status: 'Nova'
							product: _id: productId
							opportunity: _id: opportunityId

					createRequest.data.contact = _id: request.contact._id

					# console.log 'user product ->',request.lead[0]._user[0]

					createRequest.data._user = [].concat request.user if request.user

					# console.log 'ProductsPerOpportunities ->'.green, JSON.stringify createRequest, null, '  '

					saveProductResult = Meteor.call 'data:create', createRequest

					if saveProductResult.success isnt true
						response.success = false
						response.errors = response.errors.concat saveProductResult.errors
						return response

					response.processData['productsPerOpportunities'] ?= []

					response.processData['productsPerOpportunities'].push saveProductResult.data[0]

	if response.errors.length is 0
		delete response.errors

	return response

Meteor.registerMethod 'process:message', 'withUser', (request) ->
	response =
		success: true
		processData: {}
		errors: []

	campaign = findCampaign request.campaign
	if campaign?
		request.campaign = campaign

	source = findChannel request.source
	if source?
		request.source = source

	channel = findChannel request.channel
	if channel?
		request.channel = channel

	createRequest =
		document: 'Message'
		data: request

	createRequest.data.contact = [ _id: request.contact._id ]

	createRequest.data._user = [].concat request.user if request.user

	saveResult = Meteor.call 'data:create', createRequest

	if saveResult.success isnt true
		response.success = false
		response.errors = response.errors.concat saveResult.errors
		return response

	response.processData['message'] = saveResult.data[0]

	return response

Meteor.registerMethod 'process:activity', 'withUser', (request) ->
	response =
		success: true
		processData: {}
		errors: []

	if request.campaign?.code? and not request.campaign?._id?
		record = Meteor.call 'data:find:all',
			document: 'Campaign'
			filter:
				conditions: [
					term: 'code'
					operator: 'equals'
					value: parseInt request.campaign?.code
				]
			fields: '_id'

		if record?.data?[0]?._id?
			request.campaign._id = record.data[0]._id

	createRequest =
		document: 'Activity'
		data: request

	if request.contact?._id?
		createRequest.data.contact = [ _id: request.contact._id ]

	createRequest.data._user = [].concat request.user if request.user

	saveResult = Meteor.call 'data:create', createRequest

	if saveResult.success isnt true
		response.success = false
		response.errors = response.errors.concat saveResult.errors
		return response

	response.processData['activity'] = saveResult.data[0]

	return response

### Save contact
	@param authTokenId
	@param data
	@param options
		doNotOverwriteName: set to true to not update the name of an existing contact
	@param lead
- Para salvar a lead eu recebo os seguintes dados:
	- Nome
	- Email
	- Telefone
	- Roleta
	- Campanha
	- Usuário responsável pelo contato (corretor)
- Com os dados informados, verifica se já existe um contato:
	- Primeiro busca um contato com o e-mail informado;
	- Se não achou com e-mail, busca um contato que possua o primeiro nome informado + telefone;
- Se achou um contato:
	- Atualiza o nome se o nome informado é maior que o existente;
	- Adiciona um possível novo e-mail;
	- Adiciona um possível novo telefone;
	- Atualiza a roleta;
	- Atualiza a campanha;
	- Se foi informado usuário responsável:
		- Adiciona o usuário informado como responsável do contato;
	- Se não informado usuário responsável:
		- Verifica se o contato possui uma oportunidade ativa:
			- Adiciona como responsável do contato o responsável ativo pela oportunidade atualizada mais recentemente.
		- Se não, se o contato possui uma atividade criada nos últimos 10 dias:
			- Adiciona como responsável do contato o responsável ativo pela atividade criada mais recentemente.
		- Se não, se foi informada uma roleta:
			- Adiciona como responsável do contato o próximo usuário da roleta informada.
		- Se não, verifica se a campanha informada possui uma roleta alvo:
			- Adiciona como responsável do contato o próximo usuário da roleta alvo da campanha.
		- Se não, pega o primeiro usuário ativo já responsável pelo cliente
		- Se não possui um usuário ativo responsável pelo cliente, usa o usuário da conexão (provavelmente o usuário do site)
###
Meteor.registerMethod 'process:contact', 'withUser', (request, options) ->
	context = @
	# meta = @meta

	# # Some validations of payload
	# if not _.isObject request
	# 	return new Meteor.Error 'internal-error', "[#{request.document}] Invalid payload"
	campaign = findCampaign request.campaign
	if campaign?
		request.campaign = campaign

	source = findChannel request.source
	if source?
		request.source = source

	channel = findChannel request.channel
	if channel?
		request.channel = channel

	# Define response
	response =
		success: true
		processData: {}
		errors: []

	codeSent = false
	if request.code
		codeSent = request.code

	phoneSent = []
	if request.phone? and not _.isEmpty request.phone
		phoneSent = phoneSent.concat(request.phone)

	emailSent = []
	if request.email? and not _.isEmpty request.email
		emailSent = emailSent.concat(s(request.email).trim().toLowerCase().value())

	# validate if phone or email was passed
	if codeSent is false and emailSent.length is 0 and phoneSent.length is 0
		response.success = false
		response.errors = [ new Meteor.Error 'process-contact-validation', "É obrigatório o preenchimento de ao menos um dos seguintes campos: code, email e telefone." ]
		delete response.processData
		return response

	contactUser = null

	contact = null

	if codeSent isnt false
		record = Meteor.call 'data:find:all',
			document: 'Contact'
			filter:
				conditions: [
					term: 'code'
					operator: 'equals'
					value: codeSent
				]
			limit: 1

		if record?.data?[0]?
			contact = record?.data?[0]

	# try to find a contact with given email
	if not contact? and emailSent.length > 0
		# request.email.some (email) ->
		record = Meteor.call 'data:find:all',
			document: 'Contact'
			filter:
				conditions: [
					term: 'email.address'
					operator: 'in'
					value: emailSent
				]
			limit: 1

		if record?.data?[0]?
			contact = record?.data?[0]

	# If contact not found try to find with name and phone
	if not contact? and request.name? and phoneSent.length > 0
		regexName = _.first(_.words(request.name))

		record = Meteor.call 'data:find:all',
			document: 'Contact'
			filter:
				conditions: [
					term: 'phone.phoneNumber'
					operator: 'in'
					value: phoneSent
				,
					term: 'name.full'
					operator: 'contains'
					value: regexName
				]
			limit: 1

		if record?.data?[0]?
			contact = record?.data?[0]

	contactData = {}

	if request.name?
		setName = true
		if contact?.name?.full?
			if options.doNotOverwriteName or request.name.length < contact.name.full.length
				setName = false

		if setName
			nameParts = _.words request.name
			contactData.name =
				first: _.first(nameParts)
				last: _.rest(nameParts).join(' ')

	if emailSent.length > 0
		if contact?.email?.length > 0
			firstEmailNotFound = true
			emailSent.forEach (emailAddress) ->
				if not _.findWhere _.compact(contact.email), { address: emailAddress }
					if firstEmailNotFound
						contactData.email = contact.email
						firstEmailNotFound = false

					contactData.email.push
						address: emailAddress
		else
			contactData.email = []

			emailSent.forEach (emailAddress) ->
				contactData.email.push
					address: emailAddress

	if phoneSent.length > 0
		if contact?.phone?.length > 0
			firstPhoneNotFound = true
			phoneSent.forEach (leadPhone) ->
				if not _.findWhere _.compact(contact.phone), { phoneNumber: leadPhone }
					if firstPhoneNotFound
						contactData.phone = contact.phone
						firstPhoneNotFound = false

					contactData.phone.push
						countryCode: 55
						phoneNumber: leadPhone
		else
			contactData.phone = []

			phoneSent.forEach (leadPhone) ->
				contactData.phone.push
					countryCode: 55
					phoneNumber: leadPhone

	# if no _user sent, _user will be set from users in queue
	contactData.queue = request.queue if request.queue?
	contactData.campaign = request.campaign if request.campaign?
	contactData.source = request.source if request.source?
	contactData.channel = request.channel if request.channel?
	contactData.medium = request.medium if request.medium?
	contactData.referrerURL = request.referrerURL if request.referrerURL?

	# Add extra fields to contactData
	contactData = _.extend(contactData, request.extraFields) if request.extraFields?

	# sets _user based on the data sent
	userFilter = null
	if request.user?
		if request.user.username?
			userFilter =
				conditions: [
					term: 'username'
					operator: 'equals'
					value: request.user.username
				]
		else if request.user._id?
			userFilter =
				conditions: [
					term: '_id'
					operator: 'equals'
					value: request.user._id
				]

	if userFilter?
		record = Meteor.call 'data:find:all',
			document: 'User'
			filter: userFilter
			fields: '_id'
			limit: 1

		if record?.data?.length > 0
			if contact?._user?
				if not _.findWhere _.compact(contact._user), { _id: record.data[0]._id }
					contactData._user = _.clone contact._user
					contactData._user ?= []
					contactData._user.push
						_id: record.data[0]._id
			else
				contactData._user = [ record.data[0] ]

			# @TODO testar passando _user!!! array e não array
			contactUser =
				_id: record.data[0]._id

	else
		# if a contact has been found try to set _user based on his opportunities and activities
		if contact?
			if not contactUser? and contact.activeOpportunities? and contact?.activeOpportunities > 0
				record = Meteor.call 'data:find:all',
					document: 'Opportunity'
					filter:
						conditions: [
							term: 'contact._id'
							operator: 'equals'
							value: contact._id
						,
							term: 'status'
							operator: 'in'
							value: Namespace.activeOpportunityStatuses || [
								"Nova"
								"Ofertando Imóveis"
								"Em Visitação"
								"Proposta"
								"Contrato"
								"Pré-Reserva de Lançamentos"
							]
						,
							term: '_user.active'
							operator: 'equals'
							value: true
						]
					limit: 1
					sort: [
						property: '_updatedAt'
						direction: 'DESC'
					]
					fields: '_id, _user'

				record?.data?[0]?._user?.some (userFromOpportunity) ->
					if userFromOpportunity.active is true
						contactUser = userFromOpportunity

						# console.log 'user from Opportunity ->'.magenta,contactUser

						# @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
						if not _.findWhere _.compact(contact._user), { _id: userFromOpportunity._id }
							contactData._user = _.clone contact._user
							contactData._user ?= []
							contactData._user.push userFromOpportunity

						return true

			# get recent activities from contact to find an _user
			if not contactUser? and not Namespace.ignoreUserInActivities
				record = Meteor.call 'data:find:all',
					document: 'Activity'
					filter:
						conditions: [
							term: 'contact._id'
							operator: 'equals'
							value: contact._id
						,
							term: '_createdAt'
							operator: 'greater_or_equals'
							value: moment().subtract(10,'days').toDate()
						,
							term: '_user.active'
							operator: 'equals'
							value: true
						]
					limit: 1
					sort: [
						property: '_createdAt'
						direction: 'DESC'
					]
					fields: '_id, _user'

				record?.data?[0]?._user?.some (userFromActivity) ->
					if userFromActivity.active is true
						contactUser = userFromActivity

						# console.log 'user from Activity ->'.magenta,contactUser

						# @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
						if not _.findWhere _.compact(contact._user), { _id: userFromActivity._id }
							contactData._user = _.clone contact._user
							contactData._user ?= []
							contactData._user.push userFromActivity

						return true

		# if queue is set, set _user getting next user from queue sent
		if not contactUser? and request.queue?._id?
			userQueue = metaUtils.getNextUserFromQueue request.queue._id, @user

			contactUser = userQueue.user

			# console.log 'user from queue ->'.magenta,contactUser

			if userQueue.user?._id?
				if contact?
					if not _.findWhere _.compact(contact._user), { _id: userQueue.user._id }
						contactData._user = _.clone contact._user
						contactData._user ?= []
						contactData._user.push userQueue.user
				else
					contactData._user = [ userQueue.user ]

		# if _user not set yet and campaign is set, try to find a queue set in campaign
		if not contactUser? and request.campaign?._id?
			record = Meteor.call 'data:find:all',
				document: 'Campaign'
				filter:
					conditions: [
						term: '_id'
						operator: 'equals'
						value: request.campaign._id
					]
				fields: '_id,targetQueue'

			if record?.data?[0]?.targetQueue?
				# set targetQueue from campaign to contact if not set
				if not contactData.queue?
					contactData.queue = { _id: record.data[0].targetQueue._id }

				userQueue = metaUtils.getNextUserFromQueue record.data[0].targetQueue._id, @user

				contactUser = userQueue.user

				# console.log 'user from campaign ->'.magenta,contactUser

				if userQueue.user?._id?
					if contact?
						if not _.findWhere _.compact(contact._user), { _id: userQueue.user._id }
							contactData._user = _.clone contact._user
							contactData._user ?= []
							contactData._user.push userQueue.user
					else
						contactData._user = [ userQueue.user ]

		# get an active user from _user of contact
		if not contactUser?
			contact?._user?.some (user) ->
				if user.active is true
					contactUser = user
					# console.log 'user from active user ->'.magenta,contactUser
					return true

	# sets _user with original data from contact if queue is set. prevents default behavior overwriting _user with next user from queue
	# if not contactUser? and contact?
	# 	# some contacts doesn't have _user set, so set it to current request user
	# 	if not contact._user?[0]?._id?
	# 		contactData._user = [ { _id: @user._id } ]
	# 	else if contactData.queue?
	# 		contactData._user = _.clone contact._user

	# delete source fields if contact already exists
	if contact?
		delete contactData.queue
		delete contactData.campaign
		delete contactData.source
		delete contactData.channel
		delete contactData.medium
		delete contactData.referrerURL

	# creates a contact if not found one
	if not contact?
		createRequest =
			document: 'Contact'
			data: contactData

		if contactData.code
			createRequest.ignoreAutoNumber = true

		# default data
		createRequest.data.status = 'Lead' if not contactData.status?
		createRequest.data.type = [ 'Cliente' ] if not contactData.type?

		# console.log '[data:create] ->'.yellow, JSON.stringify createRequest, null, '  '

		result = Meteor.call 'data:create', createRequest
	else if not _.isEmpty contactData
		updateRequest =
			document: 'Contact'
			data:
				ids: [ { _id: contact._id, _updatedAt: $date: contact._updatedAt.toISOString() } ]
				data: contactData

		# console.log '[data:update] ->'.yellow, JSON.stringify updateRequest, null, '  '

		result = Meteor.call 'data:update', updateRequest
	else
		result =
			success: true
			data: [ contact ]

	if _.isArray result.errors
		response.errors = response.errors.concat result.errors

	if result.success is false
		response.success = false
	else
		response.processData['contact'] = result.data[0]

		contactId = result.data[0]._id

		# set _user from created contact
		if not contactUser?
			contactUser = result.data[0]._user[0]

		response.processData['user'] = contactUser

		# # save other data sent
		# if request.save?

		# 	saveRelations = (relations, contactId, parentObj) ->
		# 		relations.some (saveObj) ->
		# 			createRequest =
		# 				document: saveObj.document
		# 				data: saveObj.data

		# 			if Meta[saveObj.document]?.fields['contact']?.isList?
		# 				createRequest.data.contact = [
		# 					_id: contactId
		# 				]
		# 			else
		# 				createRequest.data.contact = _id: contactId

		# 			if parentObj?
		# 				createRequest.data = _.extend createRequest.data, parentObj

		# 			# @TODO verificar no metodo do documento se o lookup de contato é isList para botar o array ou nao
		# 			createRequest.data._user = [ contactUser ]

		# 			saveResult = Meteor.call 'data:create', createRequest

		# 			# @TODO tratar os retornos
		# 			if saveResult.success is true
		# 				response.data = response.data.concat saveResult.data

		# 				if saveObj.relations?
		# 					relationMap = {}
		# 					relationMap[saveObj.name] = { _id: saveResult.data[0]._id }

		# 					saveRelations saveObj.relations, contactId, relationMap
		# 			else
		# 				response.errors = response.errors.concat saveResult.errors

		# 	saveRelations([].concat(request.save), contactId) if request.save?

	# Remove array of data if it's empty
	if _.isEmpty response.processData
		delete response.processData

	# Remove array of errors if it's empty
	if response.errors.length is 0
		delete response.errors

	# @TODO retornar apenas o campo _user que foi adicionado, e não todos caso o contato já exista e possua outro _user setado
	# if newUser? and response.data?.length > 0
	# 	response.data[0]._user = newUser

	# Send response
	return response

findCampaign = (search) ->
	if not search
		return null

	if search?._id?
		return {} =
			_id: search._id

	if search?.code?
		filter =
			term: 'code'
			operator: 'equals'
			value: parseInt search.code
	else if search?.identifier?
		filter =
			term: 'identifier'
			operator: 'equals'
			value: search.identifier

	if not filter
		return null

	record = Meteor.call 'data:find:all',
		document: 'Campaign'
		filter:
			conditions: [ filter ]
		fields: '_id'

	if record?.data?[0]?._id?
		return {} =
			_id: record.data[0]._id

findChannel = (search) ->
	if not search
		return null

	if search?._id?
		return {} =
			_id: search._id

	if search?.identifier?
		record = Meteor.call 'data:find:all',
			document: 'Channel'
			filter:
				conditions: [
					term: 'identifier'
					operator: 'equals'
					value: search.identifier
				]
			fields: '_id'

		if record?.data?[0]?._id?
			return {} =
				_id: record.data[0]._id
