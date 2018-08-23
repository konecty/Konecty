/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import moment from 'moment';

/* Process submit
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
*/
Meteor.registerMethod('process:submit', 'withUser', function(request) {

	const response = {
		success: true,
		processData: {},
		errors: []
	};

	if (!_.isArray(request.data)) {
		return new Meteor.Error('internal-error', "Invalid payload");
	}

	const piecesReturn = {};

	request.data.some(function(piece) {
		if (piece.name == null) { return false; }

		const params = piece.data;

		const options = piece.options || {};

		if (piece.map != null) {
			for (let field in piece.map) {
				const lookup = piece.map[field];
				const lookupValue = utils.getObjectPathAgg(response.processData, lookup);
				if (lookupValue != null) {
					utils.setObjectByPath(params, field.split('.'), lookupValue);
				}
			}
		}

		if ((response.processData['user'] != null) && (params['user'] == null)) { params['user'] = response.processData['user']; }

		// console.log 'call ->'.blue, "process:#{piece.name}", params

		if (Meteor.default_server.method_handlers[`process:${piece.name}`] != null) {
			piecesReturn[piece.name] = Meteor.call(`process:${piece.name}`, params, options);
		} else if (piece.document != null) {
			piecesReturn[piece.name] = Meteor.call("process:generic", piece.document, piece.name, params, options);
		} else {
			response.success = false;
			response.errors = [ new Meteor.Error('process-invalid-piece', "Invalid generic piece, no document specified.") ];
			return true;
		}

		// console.log 'retorno <-'.yellow, piecesReturn[piece.name]

		if ((piecesReturn[piece.name] != null ? piecesReturn[piece.name].success : undefined) !== true) {
			response.success = false;
			response.errors = response.errors.concat(piecesReturn[piece.name].errors);
			return true;
		}

		response.processData = _.extend(response.processData, piecesReturn[piece.name].processData);

		return false;
	});

	if (response.errors.length === 0) {
		delete response.errors;
	}

	return response;
});

Meteor.registerMethod('process:generic', 'withUser', function(document, name, request) {
	const response = {
		success: true,
		processData: {},
		errors: []
	};

	const createRequest = {
		document,
		data: request
	};

	if ((request.contact != null ? request.contact._id : undefined) != null) {
		if (__guard__(Meta[document] != null ? Meta[document].fields['contact'] : undefined, x => x.isList) != null) {
			createRequest.data.contact = [ {_id: request.contact._id} ];
		} else {
			createRequest.data.contact = {_id: request.contact._id};
		}
	}

	if (request.user) { createRequest.data._user = [].concat(request.user); }

	const saveResult = Meteor.call('data:create', createRequest);

	if (saveResult.success !== true) {
		response.success = false;
		response.errors = response.errors.concat(saveResult.errors);
		return response;
	}

	response.processData[name] = saveResult.data[0];

	return response;
});

Meteor.registerMethod('process:campaignTarget', 'withUser', function(request) {
	const response = {
		success: true,
		processData: {},
		errors: []
	};

	if (Namespace.skipCampaignTargetForActiveOpportunities === true) {
		const record = Meteor.call('data:find:all', {
			document: 'Contact',
			filter: {
				conditions: [{
					term: '_id',
					operator: 'equals',
					value: request.contact._id
				}
				, {
					term: 'activeOpportunities',
					operator: 'exists',
					value: true
				}
				]
			},
			limit: 1
		}
		);

		if (__guard__(record != null ? record.data : undefined, x => x.length) > 0) {
			return response;
		}
	}

	const campaign = findCampaign(request.campaign);
	if (campaign != null) {
		request.campaign = campaign;
	}

	const createRequest = {
		document: 'CampaignTarget',
		data: request
	};

	createRequest.data.contact = {_id: request.contact._id};

	if (request.user) { createRequest.data._user = [].concat(request.user); }

	const saveResult = Meteor.call('data:create', createRequest);

	if (saveResult.success !== true) {
		response.success = false;
		response.errors = response.errors.concat(saveResult.errors);
		return response;
	}

	response.processData['campaignTarget'] = saveResult.data[0];

	return response;
});

Meteor.registerMethod('process:opportunity', 'withUser', function(request) {
	let createRequest, opportunity, opportunityId;
	const response = {
		success: true,
		processData: {},
		errors: []
	};

	let record = Meteor.call('data:find:all', {
		document: 'Opportunity',
		filter: {
			conditions: [{
				term: 'contact._id',
				operator: 'equals',
				value: request.contact._id
			}
			, {
				term: 'status',
				operator: 'in',
				value: Namespace.activeOpportunityStatuses || [ 'Nova', 'Ofertando Imóveis', 'Em Visitação', 'Proposta', 'Contrato', 'Pré-Reserva de Lançamentos' ]
			}
			, {
				term: '_user._id',
				operator: 'equals',
				value: (request.user != null ? request.user._id : undefined) || ''
			}
			]
		},
		limit: 1,
		sort: [{
			property: '_updatedAt',
			direction: 'DESC'
		}
		]
	});

	// don't create an opportunity if contact already has
	if (__guard__(record != null ? record.data : undefined, x => x.length) > 0) {
		opportunity = record.data[0];
		opportunityId = record.data[0]._id;
		response.processData['opportunity'] = record.data[0];
		// console.log 'oportunidade já existe'.magenta, opportunityId
		if (Namespace.alertUserOnExistingOpportunity) {
			const date = new Date();
			const users = Models['User'].find({ _id: { $in: _.pluck(opportunity._user, '_id') }}).fetch()
			.forEach(function(user) {
				const emails = [];
				_.each(user.emails, email => emails.push((_.pick(email, 'address'))));
				return Models['Message'].insert({
					type: 'Email',
					status: 'Send',
					email: emails,
					priority: 'Alta',
					subject: `Nova Mensagem da Oportunidade ${opportunity.code}`,
					from: 'Konecty Alerts <alerts@konecty.com>',
					body: `Nova mensagem do cliente ${opportunity.contact.name.full} (${opportunity.contact.code})`,
					_createdAt: date,
					_updatedAt: date,
					discard: true
				});
			});
		}
	} else {
		createRequest = {
			document: 'Opportunity',
			data: {}
		};

		// get info from product to save as interest on opportunity
		if (request.product != null) {
			let productFilter;
			if (request.product._id != null) {
				productFilter = request.product._id;
			} else if (request.product.code != null) {
				productFilter = { code: request.product.code };
			} else if (request.product.ids != null) {
				productFilter = { _id: { $in: request.product.ids } };
			}

			Models['Product'].find(productFilter).forEach(function(product) {
				if (product['inCondominium'] != null) {
					// @TODO how to decide multiple?
					createRequest.data['inCondominium'] = product['inCondominium'];
				}

				if (product['zone'] != null) {
					if (createRequest.data['zone'] == null) { createRequest.data['zone'] = []; }
					createRequest.data['zone'].push(product['zone']);
				}

				if (product['type'] != null) {
					if (createRequest.data['filterType'] == null) { createRequest.data['filterType'] = []; }
					createRequest.data['filterType'].push(product['type']);
				}

				if (product['purpose'] != null) {
					if (createRequest.data['filterPurpose'] == null) { createRequest.data['filterPurpose'] = []; }
					createRequest.data['filterPurpose'] = createRequest.data['filterPurpose'].concat(product['purpose']);
				}

				// if product['development']?
				// 	# @TODO how to decide multiple?
				// 	createRequest.data['development'] = product['development']

				if (product['sale'] != null) {
					if (createRequest.data['minSale'] == null) { createRequest.data['minSale'] = { value: 9999999999 }; }
					if (createRequest.data['maxSale'] == null) { createRequest.data['maxSale'] = { value: 0 }; }

					if ((product['sale'].value * 0.85) < createRequest.data['minSale'].value) {
						createRequest.data['minSale'] = {
							currency: 'BRL',
							value: product['sale'].value * 0.85
						};
					}

					if ((product['sale'].value * 1.15) > createRequest.data['maxSale'].value) {
						createRequest.data['maxSale'] = {
							currency: 'BRL',
							value: product['sale'].value * 1.15
						};
					}
				}

				if (product['areaPrivate'] != null) {
					if (createRequest.data['minAreaPrivate'] == null) { createRequest.data['minAreaPrivate'] = 9999999999; }
					if (createRequest.data['maxAreaPrivate'] == null) { createRequest.data['maxAreaPrivate'] = 0; }

					if ((product['areaPrivate'] * 0.85) < createRequest.data['minAreaPrivate']) {
						createRequest.data['minAreaPrivate'] = product['areaPrivate'] * 0.85;
					}

					if ((product['areaPrivate'] * 1.15) > createRequest.data['maxAreaPrivate']) {
						createRequest.data['maxAreaPrivate'] = product['areaPrivate'] * 1.15;
					}
				}

				if (product['bedrooms'] != null) {
					if (createRequest.data['minBedrooms'] == null) { createRequest.data['minBedrooms'] = 999; }
					if (createRequest.data['maxBedrooms'] == null) { createRequest.data['maxBedrooms'] = 0; }

					if (product['bedrooms'] < createRequest.data['minBedrooms']) {
						createRequest.data['minBedrooms'] = product['bedrooms'];
					}

					if (product['bedrooms'] > createRequest.data['maxBedrooms']) {
						createRequest.data['maxBedrooms'] = product['bedrooms'];
					}
				}

				if (product['parkingSpaces'] != null) {
					if (createRequest.data['minParkingSpaces'] == null) { createRequest.data['minParkingSpaces'] = 999; }
					if (createRequest.data['maxParkingSpaces'] == null) { createRequest.data['maxParkingSpaces'] = 0; }

					if (product['parkingSpaces'] < createRequest.data['minParkingSpaces']) {
						createRequest.data['minParkingSpaces'] = product['parkingSpaces'];
					}

					if (product['parkingSpaces'] > createRequest.data['maxParkingSpaces']) {
						createRequest.data['maxParkingSpaces'] = product['parkingSpaces'];
					}
				}

				if (createRequest.data['zone'] != null) {
					createRequest.data['zone'] = _.uniq(createRequest.data['zone']);
				}

				if (createRequest.data['filterType'] != null) {
					createRequest.data['filterType'] = _.uniq(createRequest.data['filterType']);
				}

				if (createRequest.data['filterPurpose'] != null) {
					return createRequest.data['filterPurpose'] = _.uniq(createRequest.data['filterPurpose']);
				}});
		}

		const campaign = findCampaign(request.campaign);
		if (campaign != null) {
			request.campaign = campaign;
		}

		const source = findChannel(request.source);
		if (source != null) {
			request.source = source;
		}

		const channel = findChannel(request.channel);
		if (channel != null) {
			request.channel = channel;
		}

		createRequest.data = _.extend(createRequest.data, request);

		createRequest.data.contact = {_id: request.contact._id};

		if (request.user) { createRequest.data._user = [].concat(request.user); }

		// console.log 'opportunity ->'.green, JSON.stringify createRequest, null, '  '

		const saveResult = Meteor.call('data:create', createRequest);

		if (saveResult.success !== true) {
			response.success = false;
			response.errors = response.errors.concat(saveResult.errors);
			return response;
		}

		response.processData['opportunity'] = saveResult.data[0];

		opportunityId = saveResult.data[0]._id;
	}

	if (request.product != null) {
		let productsList;
		if (request.product._id != null) {
			productsList = [ request.product._id ];
		} else if (request.product.code != null) {
			record = Meteor.call('data:find:all', {
				document: 'Product',
				filter: {
					conditions: [{
						term: 'code',
						operator: 'equals',
						value: request.product.code
					}
					]
				},
				limit: 1,
				fields: '_id'
			}
			);

			// console.log 'record ->'.red,request.product.code,record

			// don't create an opportunity if concat already has
			if (__guard__(record != null ? record.data : undefined, x1 => x1.length) > 0) {
				productsList = [ record.data[0]._id ];
			}
		} else if (request.product.ids != null) {
			productsList = request.product.ids;
		}

		// console.log 'productsList ->'.yellow, productsList

		if (productsList) {
			productsList.forEach(function(productId) {
				record = Meteor.call('data:find:all', {
					document: 'ProductsPerOpportunities',
					filter: {
						conditions: [{
							term: 'product._id',
							operator: 'equals',
							value: productId
						}
						, {
							term: 'contact._id',
							operator: 'equals',
							value: request.contact._id
						}
						]
					},
					limit: 1,
					fields: '_id'
				}
				);

				// console.log 'record ->'.red,request.product.code,record

				// don't create an opportunity if concat already has
				if (__guard__(record != null ? record.data : undefined, x2 => x2.length) === 0) {
					createRequest = {
						document: 'ProductsPerOpportunities',
						data: {
							status: 'Nova',
							product: { _id: productId
						},
							opportunity: { _id: opportunityId
						}
						}
					};

					createRequest.data.contact = {_id: request.contact._id};

					// console.log 'user product ->',request.lead[0]._user[0]

					if (request.user) { createRequest.data._user = [].concat(request.user); }

					// console.log 'ProductsPerOpportunities ->'.green, JSON.stringify createRequest, null, '  '

					const saveProductResult = Meteor.call('data:create', createRequest);

					if (saveProductResult.success !== true) {
						response.success = false;
						response.errors = response.errors.concat(saveProductResult.errors);
						return response;
					}

					if (response.processData['productsPerOpportunities'] == null) { response.processData['productsPerOpportunities'] = []; }

					return response.processData['productsPerOpportunities'].push(saveProductResult.data[0]);
				}});
		}
	}

	if (response.errors.length === 0) {
		delete response.errors;
	}

	return response;
});

Meteor.registerMethod('process:message', 'withUser', function(request) {
	const response = {
		success: true,
		processData: {},
		errors: []
	};

	const campaign = findCampaign(request.campaign);
	if (campaign != null) {
		request.campaign = campaign;
	}

	const source = findChannel(request.source);
	if (source != null) {
		request.source = source;
	}

	const channel = findChannel(request.channel);
	if (channel != null) {
		request.channel = channel;
	}

	const createRequest = {
		document: 'Message',
		data: request
	};

	createRequest.data.contact = [ {_id: request.contact._id} ];

	if (request.user) { createRequest.data._user = [].concat(request.user); }

	const saveResult = Meteor.call('data:create', createRequest);

	if (saveResult.success !== true) {
		response.success = false;
		response.errors = response.errors.concat(saveResult.errors);
		return response;
	}

	response.processData['message'] = saveResult.data[0];

	return response;
});

Meteor.registerMethod('process:activity', 'withUser', function(request) {
	const response = {
		success: true,
		processData: {},
		errors: []
	};

	if (((request.campaign != null ? request.campaign.code : undefined) != null) && ((request.campaign != null ? request.campaign._id : undefined) == null)) {
		const record = Meteor.call('data:find:all', {
			document: 'Campaign',
			filter: {
				conditions: [{
					term: 'code',
					operator: 'equals',
					value: parseInt(request.campaign != null ? request.campaign.code : undefined)
				}
				]
			},
			fields: '_id'
		}
		);

		if (__guard__(__guard__(record != null ? record.data : undefined, x1 => x1[0]), x => x._id) != null) {
			request.campaign._id = record.data[0]._id;
		}
	}

	const createRequest = {
		document: 'Activity',
		data: request
	};

	if ((request.contact != null ? request.contact._id : undefined) != null) {
		createRequest.data.contact = [ {_id: request.contact._id} ];
	}

	if (request.user) { createRequest.data._user = [].concat(request.user); }

	const saveResult = Meteor.call('data:create', createRequest);

	if (saveResult.success !== true) {
		response.success = false;
		response.errors = response.errors.concat(saveResult.errors);
		return response;
	}

	response.processData['activity'] = saveResult.data[0];

	return response;
});

/* Save contact
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
*/
Meteor.registerMethod('process:contact', 'withUser', function(request, options) {
	let record, result;
	const context = this;
	// meta = @meta

	// # Some validations of payload
	// if not _.isObject request
	// 	return new Meteor.Error 'internal-error', "[#{request.document}] Invalid payload"
	const campaign = findCampaign(request.campaign);
	if (campaign != null) {
		request.campaign = campaign;
	}

	const source = findChannel(request.source);
	if (source != null) {
		request.source = source;
	}

	const channel = findChannel(request.channel);
	if (channel != null) {
		request.channel = channel;
	}

	// Define response
	const response = {
		success: true,
		processData: {},
		errors: []
	};

	let codeSent = false;
	if (request.code) {
		codeSent = request.code;
	}

	let phoneSent = [];
	if ((request.phone != null) && !_.isEmpty(request.phone)) {
		phoneSent = phoneSent.concat(request.phone);
	}

	let emailSent = [];
	if ((request.email != null) && !_.isEmpty(request.email)) {
		emailSent = emailSent.concat(s(request.email).trim().toLowerCase().value());
	}

	// validate if phone or email was passed
	if ((codeSent === false) && (emailSent.length === 0) && (phoneSent.length === 0)) {
		response.success = false;
		response.errors = [ new Meteor.Error('process-contact-validation', "É obrigatório o preenchimento de ao menos um dos seguintes campos: code, email e telefone.") ];
		delete response.processData;
		return response;
	}

	let contactUser = null;

	let contact = null;

	if (codeSent !== false) {
		record = Meteor.call('data:find:all', {
			document: 'Contact',
			filter: {
				conditions: [{
					term: 'code',
					operator: 'equals',
					value: codeSent
				}
				]
			},
			limit: 1
		}
		);

		if (__guard__(record != null ? record.data : undefined, x => x[0]) != null) {
			contact = __guard__(record != null ? record.data : undefined, x1 => x1[0]);
		}
	}

	// try to find a contact with given email
	if ((contact == null) && (emailSent.length > 0)) {
		// request.email.some (email) ->
		record = Meteor.call('data:find:all', {
			document: 'Contact',
			filter: {
				conditions: [{
					term: 'email.address',
					operator: 'in',
					value: emailSent
				}
				]
			},
			limit: 1
		}
		);

		if (__guard__(record != null ? record.data : undefined, x2 => x2[0]) != null) {
			contact = __guard__(record != null ? record.data : undefined, x3 => x3[0]);
		}
	}

	// If contact not found try to find with name and phone
	if ((contact == null) && (request.name != null) && (phoneSent.length > 0)) {
		const regexName = _.first(_.words(request.name));

		record = Meteor.call('data:find:all', {
			document: 'Contact',
			filter: {
				conditions: [{
					term: 'phone.phoneNumber',
					operator: 'in',
					value: phoneSent
				}
				, {
					term: 'name.full',
					operator: 'contains',
					value: regexName
				}
				]
			},
			limit: 1
		}
		);

		if (__guard__(record != null ? record.data : undefined, x4 => x4[0]) != null) {
			contact = __guard__(record != null ? record.data : undefined, x5 => x5[0]);
		}
	}

	let contactData = {};

	if (request.name != null) {
		let setName = true;
		if (__guard__(contact != null ? contact.name : undefined, x6 => x6.full) != null) {
			if (options.doNotOverwriteName || (request.name.length < contact.name.full.length)) {
				setName = false;
			}
		}

		if (setName) {
			const nameParts = _.words(request.name);
			contactData.name = {
				first: _.first(nameParts),
				last: _.rest(nameParts).join(' ')
			};
		}
	}

	if (emailSent.length > 0) {
		if (__guard__(contact != null ? contact.email : undefined, x7 => x7.length) > 0) {
			let firstEmailNotFound = true;
			emailSent.forEach(function(emailAddress) {
				if (!_.findWhere(_.compact(contact.email), { address: emailAddress })) {
					if (firstEmailNotFound) {
						contactData.email = contact.email;
						firstEmailNotFound = false;
					}

					return contactData.email.push({
						address: emailAddress});
				}
			});
		} else {
			contactData.email = [];

			emailSent.forEach(emailAddress =>
				contactData.email.push({
					address: emailAddress})
			);
		}
	}

	if (phoneSent.length > 0) {
		if (__guard__(contact != null ? contact.phone : undefined, x8 => x8.length) > 0) {
			let firstPhoneNotFound = true;
			phoneSent.forEach(function(leadPhone) {
				if (!_.findWhere(_.compact(contact.phone), { phoneNumber: leadPhone })) {
					if (firstPhoneNotFound) {
						contactData.phone = contact.phone;
						firstPhoneNotFound = false;
					}

					return contactData.phone.push({
						countryCode: 55,
						phoneNumber: leadPhone
					});
				}
			});
		} else {
			contactData.phone = [];

			phoneSent.forEach(leadPhone =>
				contactData.phone.push({
					countryCode: 55,
					phoneNumber: leadPhone
				})
			);
		}
	}

	// if no _user sent, _user will be set from users in queue
	if (request.queue != null) { contactData.queue = request.queue; }
	if (request.campaign != null) { contactData.campaign = request.campaign; }
	if (request.source != null) { contactData.source = request.source; }
	if (request.channel != null) { contactData.channel = request.channel; }
	if (request.medium != null) { contactData.medium = request.medium; }
	if (request.referrerURL != null) { contactData.referrerURL = request.referrerURL; }

	// Add extra fields to contactData
	if (request.extraFields != null) { contactData = _.extend(contactData, request.extraFields); }

	// sets _user based on the data sent
	let userFilter = null;
	if (request.user != null) {
		if (request.user.username != null) {
			userFilter = {
				conditions: [{
					term: 'username',
					operator: 'equals',
					value: request.user.username
				}
				]
			};
		} else if (request.user._id != null) {
			userFilter = {
				conditions: [{
					term: '_id',
					operator: 'equals',
					value: request.user._id
				}
				]
			};
		}
	}

	if (userFilter != null) {
		record = Meteor.call('data:find:all', {
			document: 'User',
			filter: userFilter,
			fields: '_id',
			limit: 1
		}
		);

		if (__guard__(record != null ? record.data : undefined, x9 => x9.length) > 0) {
			if ((contact != null ? contact._user : undefined) != null) {
				if (!_.findWhere(_.compact(contact._user), { _id: record.data[0]._id })) {
					contactData._user = _.clone(contact._user);
					if (contactData._user == null) { contactData._user = []; }
					contactData._user.push({
						_id: record.data[0]._id});
				}
			} else {
				contactData._user = [ record.data[0] ];
			}

			// @TODO testar passando _user!!! array e não array
			contactUser =
				{_id: record.data[0]._id};
		}

	} else {
		// if a contact has been found try to set _user based on his opportunities and activities
		let userQueue;
		if (contact != null) {
			if ((contactUser == null) && (contact.activeOpportunities != null) && ((contact != null ? contact.activeOpportunities : undefined) > 0)) {
				record = Meteor.call('data:find:all', {
					document: 'Opportunity',
					filter: {
						conditions: [{
							term: 'contact._id',
							operator: 'equals',
							value: contact._id
						}
						, {
							term: 'status',
							operator: 'in',
							value: Namespace.activeOpportunityStatuses || [
								"Nova",
								"Ofertando Imóveis",
								"Em Visitação",
								"Proposta",
								"Contrato",
								"Pré-Reserva de Lançamentos"
							]
						}
						, {
							term: '_user.active',
							operator: 'equals',
							value: true
						}
						]
					},
					limit: 1,
					sort: [{
						property: '_updatedAt',
						direction: 'DESC'
					}
					],
					fields: '_id, _user'
				}
				);

				__guard__(__guard__(__guard__(record != null ? record.data : undefined, x12 => x12[0]), x11 => x11._user), x10 => x10.some(function(userFromOpportunity) {
					if (userFromOpportunity.active === true) {
						contactUser = userFromOpportunity;

						// console.log 'user from Opportunity ->'.magenta,contactUser

						// @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
						if (!_.findWhere(_.compact(contact._user), { _id: userFromOpportunity._id })) {
							contactData._user = _.clone(contact._user);
							if (contactData._user == null) { contactData._user = []; }
							contactData._user.push(userFromOpportunity);
						}

						return true;
					}
				}));
			}

			// get recent activities from contact to find an _user
			if ((contactUser == null) && !Namespace.ignoreUserInActivities) {
				record = Meteor.call('data:find:all', {
					document: 'Activity',
					filter: {
						conditions: [{
							term: 'contact._id',
							operator: 'equals',
							value: contact._id
						}
						, {
							term: '_createdAt',
							operator: 'greater_or_equals',
							value: moment().subtract(10,'days').toDate()
						}
						, {
							term: '_user.active',
							operator: 'equals',
							value: true
						}
						]
					},
					limit: 1,
					sort: [{
						property: '_createdAt',
						direction: 'DESC'
					}
					],
					fields: '_id, _user'
				}
				);

				__guard__(__guard__(__guard__(record != null ? record.data : undefined, x15 => x15[0]), x14 => x14._user), x13 => x13.some(function(userFromActivity) {
					if (userFromActivity.active === true) {
						contactUser = userFromActivity;

						// console.log 'user from Activity ->'.magenta,contactUser

						// @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
						if (!_.findWhere(_.compact(contact._user), { _id: userFromActivity._id })) {
							contactData._user = _.clone(contact._user);
							if (contactData._user == null) { contactData._user = []; }
							contactData._user.push(userFromActivity);
						}

						return true;
					}
				}));
			}
		}

		// if queue is set, set _user getting next user from queue sent
		if ((contactUser == null) && ((request.queue != null ? request.queue._id : undefined) != null)) {
			userQueue = metaUtils.getNextUserFromQueue(request.queue._id, this.user);

			contactUser = userQueue.user;

			// console.log 'user from queue ->'.magenta,contactUser

			if ((userQueue.user != null ? userQueue.user._id : undefined) != null) {
				if (contact != null) {
					if (!_.findWhere(_.compact(contact._user), { _id: userQueue.user._id })) {
						contactData._user = _.clone(contact._user);
						if (contactData._user == null) { contactData._user = []; }
						contactData._user.push(userQueue.user);
					}
				} else {
					contactData._user = [ userQueue.user ];
				}
			}
		}

		// if _user not set yet and campaign is set, try to find a queue set in campaign
		if ((contactUser == null) && ((request.campaign != null ? request.campaign._id : undefined) != null)) {
			record = Meteor.call('data:find:all', {
				document: 'Campaign',
				filter: {
					conditions: [{
						term: '_id',
						operator: 'equals',
						value: request.campaign._id
					}
					]
				},
				fields: '_id,targetQueue'
			}
			);

			if (__guard__(__guard__(record != null ? record.data : undefined, x17 => x17[0]), x16 => x16.targetQueue) != null) {
				// set targetQueue from campaign to contact if not set
				if ((contactData.queue == null)) {
					contactData.queue = { _id: record.data[0].targetQueue._id };
				}

				userQueue = metaUtils.getNextUserFromQueue(record.data[0].targetQueue._id, this.user);

				contactUser = userQueue.user;

				// console.log 'user from campaign ->'.magenta,contactUser

				if ((userQueue.user != null ? userQueue.user._id : undefined) != null) {
					if (contact != null) {
						if (!_.findWhere(_.compact(contact._user), { _id: userQueue.user._id })) {
							contactData._user = _.clone(contact._user);
							if (contactData._user == null) { contactData._user = []; }
							contactData._user.push(userQueue.user);
						}
					} else {
						contactData._user = [ userQueue.user ];
					}
				}
			}
		}

		// get an active user from _user of contact
		if ((contactUser == null)) {
			__guard__(contact != null ? contact._user : undefined, x18 => x18.some(function(user) {
				if (user.active === true) {
					contactUser = user;
					// console.log 'user from active user ->'.magenta,contactUser
					return true;
				}
			}));
		}
	}

	// sets _user with original data from contact if queue is set. prevents default behavior overwriting _user with next user from queue
	// if not contactUser? and contact?
	// 	# some contacts doesn't have _user set, so set it to current request user
	// 	if not contact._user?[0]?._id?
	// 		contactData._user = [ { _id: @user._id } ]
	// 	else if contactData.queue?
	// 		contactData._user = _.clone contact._user

	// delete source fields if contact already exists
	if (contact != null) {
		delete contactData.queue;
		delete contactData.campaign;
		delete contactData.source;
		delete contactData.channel;
		delete contactData.medium;
		delete contactData.referrerURL;
	}

	// creates a contact if not found one
	if ((contact == null)) {
		const createRequest = {
			document: 'Contact',
			data: contactData
		};

		if (contactData.code) {
			createRequest.ignoreAutoNumber = true;
		}

		// default data
		if ((contactData.status == null)) { createRequest.data.status = 'Lead'; }
		if ((contactData.type == null)) { createRequest.data.type = [ 'Cliente' ]; }

		// console.log '[data:create] ->'.yellow, JSON.stringify createRequest, null, '  '

		result = Meteor.call('data:create', createRequest);
	} else if (!_.isEmpty(contactData)) {
		const updateRequest = {
			document: 'Contact',
			data: {
				ids: [ { _id: contact._id, _updatedAt: {$date: contact._updatedAt.toISOString()} } ],
				data: contactData
			}
		};

		// console.log '[data:update] ->'.yellow, JSON.stringify updateRequest, null, '  '

		result = Meteor.call('data:update', updateRequest);
	} else {
		result = {
			success: true,
			data: [ contact ]
		};
	}

	if (_.isArray(result.errors)) {
		response.errors = response.errors.concat(result.errors);
	}

	if (result.success === false) {
		response.success = false;
	} else {
		response.processData['contact'] = result.data[0];

		const contactId = result.data[0]._id;

		// set _user from created contact
		if ((contactUser == null)) {
			contactUser = result.data[0]._user[0];
		}

		response.processData['user'] = contactUser;
	}

		// # save other data sent
		// if request.save?

		// 	saveRelations = (relations, contactId, parentObj) ->
		// 		relations.some (saveObj) ->
		// 			createRequest =
		// 				document: saveObj.document
		// 				data: saveObj.data

		// 			if Meta[saveObj.document]?.fields['contact']?.isList?
		// 				createRequest.data.contact = [
		// 					_id: contactId
		// 				]
		// 			else
		// 				createRequest.data.contact = _id: contactId

		// 			if parentObj?
		// 				createRequest.data = _.extend createRequest.data, parentObj

		// 			# @TODO verificar no metodo do documento se o lookup de contato é isList para botar o array ou nao
		// 			createRequest.data._user = [ contactUser ]

		// 			saveResult = Meteor.call 'data:create', createRequest

		// 			# @TODO tratar os retornos
		// 			if saveResult.success is true
		// 				response.data = response.data.concat saveResult.data

		// 				if saveObj.relations?
		// 					relationMap = {}
		// 					relationMap[saveObj.name] = { _id: saveResult.data[0]._id }

		// 					saveRelations saveObj.relations, contactId, relationMap
		// 			else
		// 				response.errors = response.errors.concat saveResult.errors

		// 	saveRelations([].concat(request.save), contactId) if request.save?

	// Remove array of data if it's empty
	if (_.isEmpty(response.processData)) {
		delete response.processData;
	}

	// Remove array of errors if it's empty
	if (response.errors.length === 0) {
		delete response.errors;
	}

	// @TODO retornar apenas o campo _user que foi adicionado, e não todos caso o contato já exista e possua outro _user setado
	// if newUser? and response.data?.length > 0
	// 	response.data[0]._user = newUser

	// Send response
	return response;
});

var findCampaign = function(search) {
	let filter;
	if (!search) {
		return null;
	}

	if ((search != null ? search._id : undefined) != null) {
		let ref;
		return ref = {_id: search._id}, ref;
	}

	if ((search != null ? search.code : undefined) != null) {
		filter = {
			term: 'code',
			operator: 'equals',
			value: parseInt(search.code)
		};
	} else if ((search != null ? search.identifier : undefined) != null) {
		filter = {
			term: 'identifier',
			operator: 'equals',
			value: search.identifier
		};
	}

	if (!filter) {
		return null;
	}

	const record = Meteor.call('data:find:all', {
		document: 'Campaign',
		filter: {
			conditions: [ filter ]
		},
		fields: '_id'
	}
	);

	if (__guard__(__guard__(record != null ? record.data : undefined, x1 => x1[0]), x => x._id) != null) {
		let ref1;
		return ref1 = {_id: record.data[0]._id}, ref1;
	}
};

var findChannel = function(search) {
	if (!search) {
		return null;
	}

	if ((search != null ? search._id : undefined) != null) {
		let ref;
		return ref = {_id: search._id}, ref;
	}

	if ((search != null ? search.identifier : undefined) != null) {
		const record = Meteor.call('data:find:all', {
			document: 'Channel',
			filter: {
				conditions: [{
					term: 'identifier',
					operator: 'equals',
					value: search.identifier
				}
				]
			},
			fields: '_id'
		}
		);

		if (__guard__(__guard__(record != null ? record.data : undefined, x1 => x1[0]), x => x._id) != null) {
			let ref1;
			return ref1 = {_id: record.data[0]._id}, ref1;
		}
	}
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}