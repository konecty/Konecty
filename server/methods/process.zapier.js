import { isArray, compact, map, pluck, filter as _filter, find, get, has, size } from 'lodash';
const cheerio = require('cheerio');

const findOpportunity = function(search) {
	let filter;
	if (!search) {
		return null;
	}

	if (has(search, '_id')) {
		filter = {
			term: '_id',
			operator: 'equals',
			value: search._id
		};
	}

	if (has(search, 'rawMessageId')) {
		filter = {
			term: 'rawMessageId',
			operator: 'equals',
			value: search.rawMessageId
		};
	}

	if (has(search, 'contactId')) {
		filter = {
			term: 'contact._id',
			operator: 'equals',
			value: search.contactId
		};
	}

	if (!filter) {
		return null;
	}

	const record = Meteor.call('data:find:all', {
		document: 'Opportunity',
		filter: {
			conditions: [filter]
		},
		fields: '_id, _updatedAt, contact, rawMessageId, status'
	});

	if (has(record, 'data.0._id')) {
		return record.data[0];
	}
};

const findContactsByEmails = function(emails) {
	if (!isArray(emails)) {
		return null;
	}

	const filter = {
		term: 'email.address',
		operator: 'in',
		value: emails.map(email => email.toLowerCase())
	};

	const record = Meteor.call('data:find:all', {
		document: 'Contact',
		filter: {
			conditions: [filter]
		},
		fields: '_id, email'
	});

	if (size(get(record, 'data')) > 0) {
		return record.data;
	}

	return [];
};

const findUsersByEmails = function(emails) {
	if (!isArray(emails)) {
		return null;
	}

	const filter = {
		term: 'emails.address',
		operator: 'in',
		value: emails.map(email => email.toLowerCase())
	};

	const record = Meteor.call('data:find:all', {
		document: 'User',
		filter: {
			conditions: [filter]
		},
		fields: '_id, emails'
	});

	if (size(get(record, 'data')) > 0) {
		return record.data;
	}

	return [];
};

/* Process Zapier
	@param authTokenId
	@param data
*/
Meteor.registerMethod('process:zapier', 'withUser', function(request) {
	let contact, contactEmails, opportunity, result, updateRequest;
	console.log('[ZAPIER] ->'.blue, request.data.message_id);

	const response = {
		success: true,
		errors: []
	};

	const metas = {};
	if (request.data.body_html) {
		const $ = cheerio.load(request.data.body_html);
		$('meta').each((i, elem) => (metas[elem.attribs.name] = elem.attribs.content));
	}

	// check request.data
	// 	sender: String
	// 	text: String
	// 	headers: Match.Maybe(String)
	// 	references: Match.Maybe(String)
	// 	reply_to: Match.Maybe(String)
	// 	date: String
	// 	message_id: String
	// 	subject: String

	console.log('[ZAPIER] Metas ->'.blue, metas);

	if (metas['opportunity:_id'] && request.data.message_id) {
		opportunity = findOpportunity({ _id: metas['opportunity:_id'] });
		console.log('[ZAPIER] opportunity ->'.blue, opportunity);
		if (opportunity && !opportunity.rawMessageId) {
			updateRequest = {
				document: 'Opportunity',
				data: {
					ids: [{ _id: opportunity._id, _updatedAt: { $date: opportunity._updatedAt.toISOString() } }],
					data: {
						rawMessageId: request.data.message_id
					}
				}
			};

			result = Meteor.call('data:update', updateRequest);
			if (isArray(result.errors)) {
				response.errors = response.errors.concat(result.errors);
			}

			if (result.success === false) {
				response.success = false;
			}

			// If we are updating the opportunity, then first message exists already
			return response;
		}
	}

	let mainContact = get(opportunity, 'contact');

	if (!opportunity) {
		if (request.data.references) {
			const references = request.data.references.split(' ');
			for (let reference of references) {
				opportunity = findOpportunity({ rawMessageId: reference });
				if (opportunity) {
					if (opportunity.contact) {
						mainContact = opportunity.contact;
					}
					break;
				}
			}
		}
	}

	console.log('[ZAPIER] from email'.blue, request.data.from_email);
	console.log('[ZAPIER] to email'.blue, request.data.to);
	let fromDomain = false;
	if (
		Namespace.domain &&
		request.data.from_email &&
		request.data.from_email.indexOf(Namespace.domain) !== -1 &&
		request.data.to.indexOf(request.data.from_email) === -1
	) {
		fromDomain = true;
	}

	console.log('[ZAPIER] fromDomain'.blue, fromDomain);

	let emails = [];
	if (request.data.from_email) {
		emails = emails.concat(request.data.from_email);
	}
	if (request.data.cc) {
		emails = emails.concat(request.data.cc.split(','));
	}
	if (request.data.to) {
		emails = emails.concat(request.data.to.split(','));
	}

	const rfcMailPatternWithName = /^(?:(.*)<)?([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)(?:>?)$/;
	emails = compact(
		map(emails, function(email) {
			const matches = email.match(rfcMailPatternWithName);
			if (matches) {
				return { name: matches[1], address: matches[2] };
			}
		})
	);
	console.log('[ZAPIER] emails ->'.blue, emails);

	const users = findUsersByEmails(pluck(emails, 'address'));

	if (Namespace.domain) {
		contactEmails = _filter(pluck(emails, 'address'), email => email.indexOf(Namespace.domain) === -1);
	} else {
		contactEmails = pluck(emails, 'address');
	}

	console.log('[ZAPIER] contact emails ->'.blue, contactEmails);
	const contacts = findContactsByEmails(contactEmails);

	console.log('[ZAPIER] users ->'.blue, users);
	console.log('[ZAPIER] contacts ->'.blue, contacts);

	const notFound = [];
	for (var email of emails) {
		if (email.address.indexOf('zapiermail.com') === -1 && (!Namespace.domain || email.address.indexOf(Namespace.domain) === -1)) {
			if (
				!find(users, user => find(user.emails, { address: email.address })) &&
				!find(contacts, user => find(user.email, { address: email.address })) &&
				!find(notFound, user => ({ address: email.address }))
			) {
				notFound.push(email);
			}
		}
	}

	if (!opportunity && contacts.length > 0) {
		for (contact of contacts) {
			opportunity = findOpportunity({ contactId: contact._id });
			if (opportunity) {
				mainContact = opportunity.contact;
				break;
			}
		}
	}

	for (email of notFound) {
		const createContact = {
			document: 'Contact',
			data: {
				status: 'Lead',
				name: { first: email.name || email.address },
				email: [{ address: email.address }]
			}
		};

		if (mainContact) {
			createContact.data.mainContact = { _id: mainContact._id };
		} else if (contacts.length > 0) {
			createContact.data.mainContact = contacts[0];
		}

		if (users.length > 0) {
			createContact.data._user = users;
		}

		result = Meteor.call('data:create', createContact);
		if (result.success === true && has(result, 'data.0._id')) {
			contacts.push({ _id: result.data[0]._id });
		}
	}

	console.log('[ZAPIER] opportunity ->'.blue, opportunity);
	if (opportunity && ['New', 'Invalid', 'Lost'].includes(opportunity.status) && fromDomain) {
		updateRequest = {
			document: 'Opportunity',
			data: {
				ids: [{ _id: opportunity._id, _updatedAt: { $date: opportunity._updatedAt.toISOString() } }],
				data: {
					status: 'Validating'
				}
			}
		};

		result = Meteor.call('data:update', updateRequest);
		console.log('[ZAPIER] update opportunity status ->'.blue, opportunity.status, updateRequest.data.data.status);

		if (isArray(result.errors)) {
			response.errors = response.errors.concat(result.errors);
			response.success = false;
			return response;
		}
	}

	if (!opportunity && contacts.length > 0) {
		const createOpportunity = {
			document: 'Opportunity',
			data: {
				contact: contacts[0],
				label: request.data.subject,
				description: request.data.body_html
			}
		};

		result = Meteor.call('data:create', createOpportunity);
		if (result.success === true && has(result, 'data.0._id')) {
			opportunity = { _id: result.data[0]._id };
		}

		console.log('[ZAPIER] createOpportunity'.blue);
	}

	if (opportunity || contacts.length > 0) {
		const createMessage = {
			document: 'Message',
			data: {
				status: fromDomain ? 'Enviada' : 'Recebida',
				type: 'Email',
				subject: request.data.subject,
				from: request.data.from,
				to: request.data.to,
				cc: request.data.cc,
				body: request.data.body_html
			}
		};

		if (contacts.length > 0) {
			createMessage.data.contact = contacts;
		}

		if (users.length > 0) {
			createMessage.data._user = users;
		}

		if (opportunity) {
			createMessage.data.opportunity = opportunity;
		}

		result = Meteor.call('data:create', createMessage);
		if (isArray(result.errors)) {
			response.errors = response.errors.concat(result.errors);
		}

		if (result.success === false) {
			response.success = false;
		}

		console.log('[ZAPIER] createMessage ->'.blue, result);
	}

	if (response.errors.length === 0) {
		delete response.errors;
	}

	return response;
});
