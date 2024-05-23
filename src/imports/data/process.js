import BluebirdPromise from 'bluebird';

import moment from 'moment';

import clone from 'lodash/clone';
import compact from 'lodash/compact';
import each from 'lodash/each';
import extend from 'lodash/extend';
import _find from 'lodash/find';
import _first from 'lodash/first';
import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';
import pick from 'lodash/pick';
import set from 'lodash/set';
import size from 'lodash/size';
import some from 'lodash/some';
import tail from 'lodash/tail';
import toLower from 'lodash/toLower';
import trim from 'lodash/trim';
import uniq from 'lodash/uniq';
import unset from 'lodash/unset';
import words from 'lodash/words';

import { getUserSafe } from '@imports/auth/getUser';
import { find } from "@imports/data/api";
import { MetaObject } from '@imports/model/MetaObject';
import { create, update } from '../data/data';
import { metaDocument } from '../menu/legacy';
import { getNextUserFromQueue } from '../meta/getNextUserFromQueue';
import { logger } from '../utils/logger';
import { randomId } from '../utils/random';
import { errorReturn } from '../utils/return';

const processHandlers = {
	'process:campaignTarget': processCampaignTarget,
	'process:opportunity': processOpportunity,
	'process:message': processMessage,
	'process:activity': processActivity,
	'process:contact': processContact,
};

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

export async function processSubmit({ authTokenId, data, contextUser }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	const result = {
		success: true,
		processData: {},
		errors: [],
	};

	if (isArray(data === false)) {
		return errorReturn('Invalid payload');
	}

	const piecesReturn = {};

	await BluebirdPromise.each(data, async function (piece) {
		if (!piece.name) {
			return;
		}
		if (result.success === false) {
			return;
		}

		const params = piece.data;

		const options = piece.options || {};

		if (piece.map) {
			for (let field in piece.map) {
				const lookup = piece.map[field];
				const lookupValue = get(result.processData, lookup);
				if (lookupValue) {
					set(params, field.split('.'), lookupValue);
				}
			}
		}

		if (result.processData['user'] && !params['user']) {
			params['user'] = result.processData['user'];
		}

		if (processHandlers[`process:${piece.name}`] != null) {
			piecesReturn[piece.name] = await processHandlers[`process:${piece.name}`]({ data: params, contextUser: user, options });
		} else if (piece.document) {
			piecesReturn[piece.name] = await processGeneric({ document: piece.document, name: piece.name, data: params, contextUser: user, options });
		} else {
			result.success = false;
			result.errors = [{ message: 'Invalid generic piece, no document specified.' }];
			logger.error(result, 'Invalid generic piece, no document specified.');
			return;
		}

		if (get(piecesReturn, `${piece.name}.success`) !== true) {
			result.success = false;
			result.errors = result.errors.concat(piecesReturn[piece.name].errors.map(err => ({ ...err, piece: piece.name })));
			logger.error(result, `Error processing piece ${piece.name}.`);
			return;
		}

		result.processData = extend(result.processData, piecesReturn[piece.name].processData);
	});

	if (result.errors.length === 0) {
		unset(result, 'errors');
	}

	return result;
}

export async function processGeneric({ document, name, data, contextUser }) {
	const response = {
		success: true,
		processData: {},
		errors: [],
	};

	const createRequest = {
		document,
		data,
		contextUser,
	};

	if (has(data, 'contact._id')) {
		if (has(MetaObject.Meta, `${document}.fields.contact.isList`)) {
			createRequest.data.contact = [{ _id: data.contact._id }];
		} else {
			createRequest.data.contact = { _id: data.contact._id };
		}
	}

	if (data.user != null) {
		createRequest.data._user = [].concat(data.user);
	}

	const saveResult = await create(createRequest);

	if (saveResult.success !== true) {
		response.success = false;
		response.errors = response.errors.concat(saveResult.errors);
		return response;
	}

	response.processData[name] = saveResult.data[0];

	return response;
}

export async function processCampaignTarget({ data, contextUser }) {
	const response = {
		success: true,
		processData: {},
		errors: [],
	};

	if (MetaObject.Namespace.skipCampaignTargetForActiveOpportunities === true) {
		const record = await find({
			document: 'Contact',
			filter: {
				conditions: [
					{
						term: '_id',
						operator: 'equals',
						value: data.contact._id,
					},
					{
						term: 'activeOpportunities',
						operator: 'exists',
						value: true,
					},
				],
			},
			limit: 1,
			contextUser,
		});

		if (size(get(record, 'data')) > 0) {
			return response;
		}
	}

	const campaign = await findCampaign(data.campaign, contextUser);
	if (campaign) {
		data.campaign = campaign;
	}

	const createRequest = {
		document: 'CampaignTarget',
		data,
		contextUser,
	};

	createRequest.data.contact = { _id: data.contact._id };

	if (data.user) {
		createRequest.data._user = [].concat(data.user);
	}

	const saveResult = await create(createRequest);

	if (saveResult.success !== true) {
		response.success = false;
		response.errors = response.errors.concat(saveResult.errors);
		return response;
	}

	response.processData['campaignTarget'] = saveResult.data[0];

	return response;
}

export async function processOpportunity({ data, contextUser }) {
	let createRequest, opportunity, opportunityId;
	const response = {
		success: true,
		processData: {},
		errors: [],
	};

	let record = await find({
		document: 'Opportunity',
		filter: {
			conditions: [
				{
					term: 'contact._id',
					operator: 'equals',
					value: data.contact._id,
				},
				{
					term: 'status',
					operator: 'in',
					value: MetaObject.Namespace.activeOpportunityStatuses || ['Nova', 'Ofertando Imóveis', 'Em Visitação', 'Proposta', 'Contrato', 'Pré-Reserva de Lançamentos'],
				},
				{
					term: '_user._id',
					operator: 'equals',
					value: get(data, 'user._id', ''),
				},
			],
		},
		limit: 1,
		sort: [
			{
				property: '_updatedAt',
				direction: 'DESC',
			},
		],
		contextUser,
	});

	// don't create an opportunity if contact already has
	if (size(get(record, 'data')) > 0) {
		opportunity = record.data[0];
		opportunityId = record.data[0]._id;
		response.processData['opportunity'] = record.data[0];

		if (MetaObject.Namespace.alertUserOnExistingOpportunity) {
			const date = new Date();
			const usersToNotify = await MetaObject.Collections['User'].find({ _id: { $in: map(opportunity._user, '_id') } }).toArray();

			await BluebirdPromise.each(usersToNotify, async function (user) {
				const emails = [];
				each(user.emails, email => emails.push(pick(email, 'address')));
				return MetaObject.Collections['Message'].insert({
					_id: randomId(),
					type: 'Email',
					status: 'Send',
					email: emails,
					priority: 'Alta',
					subject: `Nova Mensagem da Oportunidade ${opportunity.code}`,
					from: 'Konecty Alerts <alerts@konecty.com>',
					body: `Nova mensagem do cliente ${opportunity.contact.name.full} (${opportunity.contact.code})`,
					_createdAt: date,
					_updatedAt: date,
					discard: true,
				});
			});
		}
	} else {
		createRequest = {
			document: 'Opportunity',
			data: {},
			contextUser,
		};

		// get info from product to save as interest on opportunity
		if (data.product) {
			let productFilter;
			if (data.product._id) {
				productFilter = data.product._id;
			} else if (data.product.code) {
				productFilter = { code: data.product.code };
			} else if (data.product.ids) {
				productFilter = { _id: { $in: data.product.ids } };
			}

			const products = await MetaObject.Collections['Product'].find(productFilter).toArray();

			products.forEach(product => {
				if (product['inCondominium']) {
					// @TODO how to decide multiple?
					createRequest.data['inCondominium'] = product['inCondominium'];
				}

				if (product['zone']) {
					if (!createRequest.data['zone']) {
						createRequest.data['zone'] = [];
					}
					createRequest.data['zone'].push(product['zone']);
				}

				if (product['type']) {
					if (!createRequest.data['filterType']) {
						createRequest.data['filterType'] = [];
					}
					createRequest.data['filterType'].push(product['type']);
				}

				if (product['purpose']) {
					if (!createRequest.data['filterPurpose']) {
						createRequest.data['filterPurpose'] = [];
					}
					createRequest.data['filterPurpose'] = createRequest.data['filterPurpose'].concat(product['purpose']);
				}

				// if product['development']?
				// 	# @TODO how to decide multiple?
				// 	createRequest.data['development'] = product['development']

				if (product['sale']) {
					if (!createRequest.data['minSale']) {
						createRequest.data['minSale'] = { value: 9999999999 };
					}
					if (!createRequest.data['maxSale']) {
						createRequest.data['maxSale'] = { value: 0 };
					}

					if (product['sale'].value * 0.85 < createRequest.data['minSale'].value) {
						createRequest.data['minSale'] = {
							currency: 'BRL',
							value: product['sale'].value * 0.85,
						};
					}

					if (product['sale'].value * 1.15 > createRequest.data['maxSale'].value) {
						createRequest.data['maxSale'] = {
							currency: 'BRL',
							value: product['sale'].value * 1.15,
						};
					}
				}

				if (product['areaPrivate']) {
					if (!createRequest.data['minAreaPrivate']) {
						createRequest.data['minAreaPrivate'] = 9999999999;
					}
					if (!createRequest.data['maxAreaPrivate']) {
						createRequest.data['maxAreaPrivate'] = 0;
					}

					if (product['areaPrivate'] * 0.85 < createRequest.data['minAreaPrivate']) {
						createRequest.data['minAreaPrivate'] = product['areaPrivate'] * 0.85;
					}

					if (product['areaPrivate'] * 1.15 > createRequest.data['maxAreaPrivate']) {
						createRequest.data['maxAreaPrivate'] = product['areaPrivate'] * 1.15;
					}
				}

				if (product['bedrooms']) {
					if (!createRequest.data['minBedrooms']) {
						createRequest.data['minBedrooms'] = 999;
					}
					if (!createRequest.data['maxBedrooms']) {
						createRequest.data['maxBedrooms'] = 0;
					}

					if (product['bedrooms'] < createRequest.data['minBedrooms']) {
						createRequest.data['minBedrooms'] = product['bedrooms'];
					}

					if (product['bedrooms'] > createRequest.data['maxBedrooms']) {
						createRequest.data['maxBedrooms'] = product['bedrooms'];
					}
				}

				if (product['parkingSpaces']) {
					if (!createRequest.data['minParkingSpaces']) {
						createRequest.data['minParkingSpaces'] = 999;
					}
					if (!createRequest.data['maxParkingSpaces']) {
						createRequest.data['maxParkingSpaces'] = 0;
					}

					if (product['parkingSpaces'] < createRequest.data['minParkingSpaces']) {
						createRequest.data['minParkingSpaces'] = product['parkingSpaces'];
					}

					if (product['parkingSpaces'] > createRequest.data['maxParkingSpaces']) {
						createRequest.data['maxParkingSpaces'] = product['parkingSpaces'];
					}
				}

				if (createRequest.data['zone']) {
					createRequest.data['zone'] = uniq(createRequest.data['zone']);
				}

				if (createRequest.data['filterType']) {
					createRequest.data['filterType'] = uniq(createRequest.data['filterType']);
				}

				if (createRequest.data['filterPurpose']) {
					return (createRequest.data['filterPurpose'] = uniq(createRequest.data['filterPurpose']));
				}
			});
		}

		const campaign = await findCampaign(data.campaign, contextUser);
		if (campaign) {
			data.campaign = campaign;
		}

		const source = await findChannel(data.source, contextUser);
		if (source) {
			data.source = source;
		}

		const channel = await findChannel(data.channel, contextUser);
		if (channel) {
			data.channel = channel;
		}

		createRequest.data = extend(createRequest.data, data);

		createRequest.data.contact = { _id: data.contact._id };

		if (data.user) {
			createRequest.data._user = [].concat(data.user);
		}

		const saveResult = await create(createRequest);

		if (saveResult.success !== true) {
			response.success = false;
			response.errors = response.errors.concat(saveResult.errors);
			return response;
		}

		response.processData['opportunity'] = saveResult.data[0];

		opportunityId = saveResult.data[0]._id;
	}

	if (data.product) {
		let productsList;
		if (data.product._id) {
			productsList = [data.product._id];
		} else if (data.product.code) {
			record = await find({
				document: 'Product',
				filter: {
					conditions: [
						{
							term: 'code',
							operator: 'equals',
							value: data.product.code,
						},
					],
				},
				limit: 1,
				fields: '_id',
				contextUser,
			});

			// don't create an opportunity if concat already has
			if (size(get(record, 'data')) > 0) {
				productsList = [record.data[0]._id];
			}
		} else if (data.product.ids) {
			productsList = data.product.ids;
		}

		if (productsList) {
			await BluebirdPromise.each(productsList, async function (productId) {
				record = await find({
					document: 'ProductsPerOpportunities',
					filter: {
						conditions: [
							{
								term: 'product._id',
								operator: 'equals',
								value: productId,
							},
							{
								term: 'contact._id',
								operator: 'equals',
								value: data.contact._id,
							},
						],
					},
					limit: 1,
					fields: '_id',
					contextUser,
				});

				// don't create an opportunity if concat already has
				if (size(get(record, 'data')) === 0) {
					createRequest = {
						document: 'ProductsPerOpportunities',
						data: {
							status: 'Nova',
							product: {
								_id: productId,
							},
							opportunity: {
								_id: opportunityId,
							},
						},
						contextUser,
					};

					createRequest.data.contact = { _id: data.contact._id };

					if (data.user) {
						createRequest.data._user = [].concat(data.user);
					}

					const saveProductResult = await create(createRequest);

					if (saveProductResult.success !== true) {
						response.success = false;
						response.errors = response.errors.concat(saveProductResult.errors);
						return response;
					}

					if (!response.processData['productsPerOpportunities']) {
						response.processData['productsPerOpportunities'] = [];
					}

					return response.processData['productsPerOpportunities'].push(saveProductResult.data[0]);
				}
			});
		}
	}

	if (response.errors.length === 0) {
		delete response.errors;
	}

	return response;
}

export async function processMessage({ data, contextUser }) {
	const response = {
		success: true,
		processData: {},
		errors: [],
	};

	const campaign = await findCampaign(data.campaign, contextUser);
	if (campaign) {
		data.campaign = campaign;
	}

	const source = await findChannel(data.source, contextUser);
	if (source) {
		data.source = source;
	}

	const channel = await findChannel(data.channel, contextUser);
	if (channel) {
		data.channel = channel;
	}

	const createRequest = {
		document: 'Message',
		data: data,
		contextUser,
	};

	createRequest.data.contact = [{ _id: data.contact._id }];

	if (data.user) {
		createRequest.data._user = [].concat(data.user);
	}

	const saveResult = await create(createRequest);

	if (saveResult.success !== true) {
		response.success = false;
		response.errors = response.errors.concat(saveResult.errors);
		return response;
	}

	response.processData['message'] = saveResult.data[0];

	return response;
}

export async function processActivity({ data, contextUser }) {
	const response = {
		success: true,
		processData: {},
		errors: [],
	};

	if (has(data, 'campaign.code') && !has(data, 'campaign._id')) {
		const record = await find({
			document: 'Campaign',
			filter: {
				conditions: [
					{
						term: 'code',
						operator: 'equals',
						value: parseInt(get(data, 'campaign.code')),
					},
				],
			},
			fields: '_id',
			contextUser,
		});

		if (has(record, 'data.0._id')) {
			data.campaign._id = record.data[0]._id;
		}
	}

	const createRequest = {
		document: 'Activity',
		data: data,
		contextUser,
	};

	if (has(data, 'contact._id')) {
		createRequest.data.contact = [{ _id: data.contact._id }];
	}

	if (data.user) {
		createRequest.data._user = [].concat(data.user);
	}

	const saveResult = await create(createRequest);

	if (saveResult.success !== true) {
		response.success = false;
		response.errors = response.errors.concat(saveResult.errors);
		return response;
	}

	response.processData['activity'] = saveResult.data[0];

	return response;
}

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

export async function processContact({ data, options, contextUser }) {
	let record, result;
	// const context = this;
	// meta = @meta

	// # Some validations of payload
	// if not _.isObject request
	// 	return { success: false, message:  "[#{request.document}] Invalid payload" }
	const campaign = await findCampaign(data.campaign, contextUser);
	if (campaign) {
		data.campaign = campaign;
	}

	const source = await findChannel(data.source, contextUser);
	if (source) {
		data.source = source;
	}

	const channel = await findChannel(data.channel, contextUser);
	if (channel) {
		data.channel = channel;
	}

	// Define response
	const response = {
		success: true,
		processData: {},
		errors: [],
	};

	let codeSent = false;
	if (data.code) {
		codeSent = data.code;
	}
	let phoneSent = [];

	if (data.phone && !isEmpty(data.phone)) {
		phoneSent = phoneSent.concat(data.phone);
	}

	let emailSent = [];
	if (data.email && !isEmpty(data.email)) {
		emailSent = emailSent.concat(toLower(trim(`${data.email}`)));
	}

	// validate if phone or email was passed
	if (codeSent === false && emailSent.length === 0 && phoneSent.length === 0) {
		response.success = false;
		response.errors = [{ meaage: 'É obrigatório o preenchimento de ao menos um dos seguintes campos: code, email e telefone.' }];
		delete response.processData;
		return response;
	}

	let contactUser = null;

	let contact = null;

	if (codeSent !== false) {
		record = await find({
			document: 'Contact',
			filter: {
				conditions: [
					{
						term: 'code',
						operator: 'equals',
						value: codeSent,
					},
				],
			},
			limit: 1,
			contextUser,
		});

		if (has(record, 'data.0')) {
			contact = get(record, 'data.0');
		}
	}

	// try to find a contact with given email
	if (codeSent === false && contact == null && emailSent.length > 0) {
		// request.email.some (email) ->
		record = await find({
			document: 'Contact',
			filter: {
				conditions: [
					{
						term: 'email.address',
						operator: 'in',
						value: emailSent,
					},
				],
			},
			limit: 1,
			contextUser,
		});

		if (has(record, 'data.0')) {
			contact = get(record, 'data.0');
		}
	}

	// If contact not found try to find with name and phone
	if (codeSent === false && contact == null && data.name && phoneSent.length > 0) {
		const regexName = _first(words(data.name));

		record = await find({
			document: 'Contact',
			filter: {
				conditions: [
					{
						term: 'phone.phoneNumber',
						operator: 'in',
						value: phoneSent,
					},
					{
						term: 'name.full',
						operator: 'contains',
						value: regexName,
					},
				],
			},
			limit: 1,
			contextUser,
		});

		if (has(record, 'data.0')) {
			contact = get(record, 'data.0');
		}
	}

	// If contact not found try with phone number
	if (codeSent === false && contact == null && phoneSent.length > 0) {
		record = await find({
			document: 'Contact',
			filter: {
				conditions: [
					{
						term: 'phone.phoneNumber',
						operator: 'in',
						value: phoneSent,
					},
				],
			},
			limit: 1,
			contextUser,
		});

		if (has(record, 'data.0')) {
			contact = get(record, 'data.0');
		}
	}

	let contactData = {};

	if (codeSent !== false) {
		contactData.code = codeSent;
	}

	if (data.name) {
		let setName = true;
		if (has(contact, 'name.full')) {
			if (options.doNotOverwriteName || data.name.length < contact.name.full.length) {
				setName = false;
			}
		}

		if (setName) {
			const nameParts = words(data.name);
			contactData.name = {
				first: _first(nameParts),
				last: tail(nameParts).join(' '),
			};
		}
	}

	if (emailSent.length > 0) {
		if (size(get(contact, 'email')) > 0) {
			let firstEmailNotFound = true;
			emailSent.forEach(function (emailAddress) {
				if (!_find(compact(contact.email), { address: emailAddress })) {
					if (firstEmailNotFound) {
						contactData.email = contact.email;
						firstEmailNotFound = false;
					}

					return contactData.email.push({
						address: emailAddress,
					});
				}
			});
		} else {
			contactData.email = [];

			emailSent.forEach(emailAddress =>
				contactData.email.push({
					address: emailAddress,
				}),
			);
		}
	}

	if (phoneSent.length > 0) {
		if (size(get(contact, 'phone')) > 0) {
			let firstPhoneNotFound = true;
			phoneSent.forEach(function (leadPhone) {
				if (!_find(compact(contact.phone), { phoneNumber: leadPhone })) {
					if (firstPhoneNotFound) {
						contactData.phone = contact.phone;
						firstPhoneNotFound = false;
					}

					return contactData.phone.push({
						countryCode: 55,
						phoneNumber: leadPhone,
					});
				}
			});
		} else {
			contactData.phone = [];

			phoneSent.forEach(leadPhone =>
				contactData.phone.push({
					countryCode: 55,
					phoneNumber: leadPhone,
				}),
			);
		}
	}

	// if no _user sent, _user will be set from users in queue
	if (data.queue) {
		contactData.queue = data.queue;
	}
	if (data.campaign) {
		contactData.campaign = data.campaign;
	}
	if (data.source) {
		contactData.source = data.source;
	}
	if (data.channel) {
		contactData.channel = data.channel;
	}
	if (data.medium) {
		contactData.medium = data.medium;
	}
	if (data.referrerURL) {
		contactData.referrerURL = data.referrerURL;
	}

	// Add extra fields to contactData
	if (data.extraFields) {
		contactData = extend(contactData, data.extraFields);
	}

	// sets _user based on the data sent
	let userFilter = null;
	if (data.user) {
		if (data.user.username) {
			userFilter = {
				conditions: [
					{
						term: 'username',
						operator: 'equals',
						value: data.user.username,
					},
				],
			};
		} else if (data.user._id) {
			userFilter = {
				conditions: [
					{
						term: '_id',
						operator: 'equals',
						value: data.user._id,
					},
				],
			};
		}
	}

	if (userFilter) {
		record = await find({
			document: 'User',
			filter: userFilter,
			fields: '_id',
			limit: 1,
			contextUser,
		});

		if (size(get(record, 'data')) > 0) {
			if (has(contact, '_user')) {
				if (!_find(compact(contact._user), { _id: record.data[0]._id })) {
					contactData._user = clone(contact._user);
					if (!contactData._user) {
						contactData._user = [];
					}
					contactData._user.push({
						_id: record.data[0]._id,
					});
				}
			} else {
				contactData._user = [record.data[0]];
			}

			// @TODO testar passando _user!!! array e não array
			contactUser = { _id: record.data[0]._id };
		}
	} else {
		// if a contact has been found try to set _user based on his opportunities and activities
		let userQueue;
		if (contact) {
			if (!contactUser && contact.activeOpportunities && get(contact, 'activeOpportunities', 0) > 0) {
				record = await find({
					document: 'Opportunity',
					filter: {
						conditions: [
							{
								term: 'contact._id',
								operator: 'equals',
								value: contact._id,
							},
							{
								term: 'status',
								operator: 'in',
								value: MetaObject.Namespace.activeOpportunityStatuses || [
									'Nova',
									'Ofertando Imóveis',
									'Em Visitação',
									'Proposta',
									'Contrato',
									'Pré-Reserva de Lançamentos',
								],
							},
							{
								term: '_user.active',
								operator: 'equals',
								value: true,
							},
						],
					},
					limit: 1,
					sort: [
						{
							property: '_updatedAt',
							direction: 'DESC',
						},
					],
					fields: '_id, _user',
					contextUser,
				});

				some(get(record, 'data.0._user'), userFromOpportunity => {
					if (userFromOpportunity.active === true) {
						contactUser = userFromOpportunity;
						// @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
						if (!_find(compact(contact._user), { _id: userFromOpportunity._id })) {
							contactData._user = clone(contact._user);
							if (!contactData._user) {
								contactData._user = [];
							}
							contactData._user.push(userFromOpportunity);
						}

						return true;
					}
				});
			}

			// get recent activities from contact to find an _user
			if (!contactUser && !MetaObject.Namespace.ignoreUserInActivities) {
				record = find({
					document: 'Activity',
					filter: {
						conditions: [
							{
								term: 'contact._id',
								operator: 'equals',
								value: contact._id,
							},
							{
								term: '_createdAt',
								operator: 'greater_or_equals',
								value: moment().subtract(10, 'days').toDate(),
							},
							{
								term: '_user.active',
								operator: 'equals',
								value: true,
							},
						],
					},
					limit: 1,
					sort: [
						{
							property: '_createdAt',
							direction: 'DESC',
						},
					],
					fields: '_id, _user',
					contextUser,
				});

				some(get(record, 'data.0._user'), userFromActivity => {
					if (userFromActivity.active === true) {
						contactUser = userFromActivity;

						// @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
						if (!_find(compact(contact._user), { _id: userFromActivity._id })) {
							contactData._user = clone(contact._user);
							if (!contactData._user) {
								contactData._user = [];
							}
							contactData._user.push(userFromActivity);
						}

						return true;
					}
				});
			}
		}
		// if queue is set, set _user getting next user from queue sent
		if (!contactUser && has(data, 'queue._id')) {
			userQueue = await getNextUserFromQueue(data.queue._id, contextUser);

			contactUser = userQueue.user;

			if (has(userQueue, 'user._id')) {
				if (contact) {
					if (!_find(compact(contact._user), { _id: userQueue.user._id })) {
						contactData._user = clone(contact._user);
						if (!contactData._user) {
							contactData._user = [];
						}
						contactData._user.push(userQueue.user);
					}
				} else {
					contactData._user = [userQueue.user];
				}
			}
		}

		// if _user not set yet and campaign is set, try to find a queue set in campaign
		if (!contactUser && has(data, 'campaign._id')) {
			record = find({
				document: 'Campaign',
				filter: {
					conditions: [
						{
							term: '_id',
							operator: 'equals',
							value: data.campaign._id,
						},
					],
				},
				fields: '_id,targetQueue',
				contextUser,
			});

			if (has(record, 'data.0.targetQueue')) {
				// set targetQueue from campaign to contact if not set
				if (!contactData.queue) {
					contactData.queue = { _id: record.data[0].targetQueue._id };
				}

				userQueue = await getNextUserFromQueue(record.data[0].targetQueue._id, contextUser);

				contactUser = userQueue.user;

				if (has(userQueue, 'user._id')) {
					if (contact) {
						if (!_find(compact(contact._user), { _id: userQueue.user._id })) {
							contactData._user = clone(contact._user);
							if (!contactData._user) {
								contactData._user = [];
							}
							contactData._user.push(userQueue.user);
						}
					} else {
						contactData._user = [userQueue.user];
					}
				}
			}
		}

		// get an active user from _user of contact
		if (!contactUser) {
			some(get(contact, '_user'), user => {
				if (user.active === true) {
					contactUser = user;

					return true;
				}
			});
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
	if (contact == null) {
		const createRequest = {
			document: 'Contact',
			data: contactData,
			contextUser,
		};

		if (contactData.code) {
			createRequest.ignoreAutoNumber = true;
		}

		const {
			fields: { status, type },
		} = await metaDocument({ document: 'Contact', contextUser });

		// Use defaultValue field from status and type metas
		if (!contactData.status) {
			if (status && status.defaultValue) createRequest.data.status = status.defaultValue;
		}
		if (!contactData.type) {
			if (type && type.defaultValue) createRequest.data.type = type.maxSelected > 1 || type.isList === true ? [].concat(type.defaultValue) : type.defaultValue;
		}

		result = await create(createRequest);
	} else if (!isEmpty(contactData)) {
		const updateRequest = {
			document: 'Contact',
			data: {
				ids: [{ _id: contact._id, _updatedAt: { $date: moment(contact._updatedAt).toISOString() } }],
				data: contactData,
			},
			contextUser,
		};

		result = await update(updateRequest);
	} else {
		result = {
			success: true,
			data: [contact],
		};
	}

	if (isArray(result.errors)) {
		response.errors = response.errors.concat(result.errors);
	}

	if (result.success === false) {
		response.success = false;
	} else {
		response.processData['contact'] = result.data[0];

		// const contactId = result.data[0]._id;

		// set _user from created contact
		if (!contactUser) {
			contactUser = result.data[0]._user[0];
		}

		response.processData['user'] = contactUser;
	}

	// Remove array of data if it's empty
	if (isEmpty(response.processData)) {
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
}

async function findCampaign(search, contextUser) {
	let filter;
	if (!search) {
		return null;
	}

	if (has(search, '_id')) {
		let ref;
		return (ref = { _id: search._id }), ref;
	}

	if (has(search, 'code')) {
		filter = {
			term: 'code',
			operator: 'equals',
			value: parseInt(search.code),
		};
	} else if (has(search, 'identifier')) {
		filter = {
			term: 'identifier',
			operator: 'equals',
			value: search.identifier,
		};
	}

	if (!filter) {
		return null;
	}

	const record = await find({
		document: 'Campaign',
		filter: {
			conditions: [filter],
		},
		fields: '_id',
		contextUser,
	});

	if (has(record, 'data.0._id')) {
		let ref1;
		return (ref1 = { _id: record.data[0]._id }), ref1;
	}
}

async function findChannel(search, contextUser) {
	if (!search) {
		return null;
	}

	if (has(search, '_id')) {
		let ref;
		return (ref = { _id: search._id }), ref;
	}

	if (has(search, 'identifier')) {
		const record = await find({
			document: 'Channel',
			filter: {
				conditions: [
					{
						term: 'identifier',
						operator: 'equals',
						value: search.identifier,
					},
				],
			},
			fields: '_id',
			contextUser,
		});

		if (has(record, 'data.0._id')) {
			let ref1;
			return (ref1 = { _id: record.data[0]._id }), ref1;
		}
	}
}
