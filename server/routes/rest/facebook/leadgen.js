import moment from 'moment';

import crypto from 'crypto';

var asPhone = function(value) {
	value = value.replace('+55', '').replace(/[^\d]/g, '');
	return (value.length < 10 || value.length > 12) ? false : value;
};

var getNotes = function(leadData) {
	var notes = '';
	for (index in leadData) {
		if (leadData.hasOwnProperty(index)) {
			switch(leadData[index].name) {
				case 'region':
					notes += 'Região: ' + leadData[index].values[0] + '<br>\n';
					break;
				case 'relationship_status':
					notes += 'Status de relacionamento: ' + leadData[index].values[0] + '<br>\n';
					break;
				case 'company_name':
					notes += 'Nome da empresa: ' + leadData[index].values[0] + '<br>\n';
					break;
				case 'gender':
					notes += 'Gênero: ' + leadData[index].values[0] + '<br>\n';
					break;
				case 'marital_status':
					notes += 'Estado civil: ' + leadData[index].values[0] + '<br>\n';
					break;
				case 'military_status':
					notes += 'Situação militar: ' + leadData[index].values[0] + '<br>\n';
					break;
				default:
					notes += leadData[index].name + ': ' + leadData[index].values[0] + '<br>\n';
					break;
			}
		}
	}
	return s.trim(notes);
}

var makeContact = function(leadData, campaign) {
	var contact = { extraFields: {} };
	var address = {};
	for (index in leadData) {
		if (leadData.hasOwnProperty(index)) {
			switch(leadData[index].name) {
				case 'email':
					contact['email'] = (contact['email'] || []).concat(leadData[index].values[0]);
					break;
				case 'phone_number':
					var phone = asPhone(leadData[index].values[0]);
					if (phone) {
						contact['phone'] = (contact['phone'] || []).concat(phone);
					}
					break;
				case 'date_of_birth':
					var date = moment(leadData[index].values[0], 'MM/DD/YYYY');
					if (!date.isValid()) {
						var date = moment(leadData[index].values[0], 'MM/DD');
					}
					if (!date.isValid()) {
						var date = moment(leadData[index].values[0], 'YYY');
					}
					if (date.isValid()) {
						contact.extraFields['birthdate'] = date.toDate();
					}
					break;
				case 'work_email':
					contact['email'] = (contact['email'] || []).concat(leadData[index].values[0]);
					break;
				case 'work_phone_number':
					var phone = asPhone(leadData[index].values[0]);
					if (phone) {
						contact['phone'] = (contact['phone'] || []).concat(phone);
					}
					break;
				case 'job_title':
					contact.extraFields['occupation'] = leadData[index].values[0];
					break;
				case 'post_code':
					address['postalCode'] = leadData[index].values[0].replace(/[^\d]/g, '');
					break;
				case 'country':
					address['country'] = leadData[index].values[0];
					break;
				case 'city':
					address['city'] = leadData[index].values[0];
					break;
				case 'street_address':
					address['place'] = leadData[index].values[0];
					break;
				case 'state':
					address['state'] = leadData[index].values[0];
					break;
				case 'first_name':
					contact['name'] = s.trim(leadData[index].values[0] + (contact['name'] || ''));
					break;
				case 'last_name':
					contact['name'] = s.trim((contact['name'] || '') + ' ' + leadData[index].values[0]);
					break;
				case 'full_name':
					contact['name'] = leadData[index].values[0];
					break;
			}
		}
	}
	if (!_.isEmpty(address)) {
		contact.extraFields.address = [ address ];
	}
	if (_.isEmpty(contact.extraFields)) {
		delete contact.extraFields;
	}
	if (campaign) {
		contact.campaign = _.pick(campaign, '_id', 'code', 'name', 'type');
	}
	contact.channel = { identifier: 'facebook' }
	return contact;
};

var makeOpportunity = function(campaign, formName) {
	var opportunity = {
		label: formName,
		channel: { identifier: 'facebook' }
	};
	if (campaign) {
		opportunity.campaign = _.pick(campaign, '_id', 'code', 'name', 'type');
	}
	return opportunity;
}

var makeMessage = function(campaign, formName, message) {
	var message = {
		status: 'Nova',
		priority: 'Média',
		type: 'Formulário Web',
		subject: formName,
		body: message,
		channel: { identifier: 'facebook' }
	};
	if (campaign) {
		message.campaign = _.pick(campaign, '_id', 'code', 'name', 'type');
	}
	return message;
}

var makeActivity = function(campaign, formName) {
	var activity = {
		status: 'Nova',
		priority: 'Média',
		type: 'Contato',
		subject: formName,
		channel: { identifier: 'facebook' },
		startAt: new Date()
	};
	if (campaign) {
		activity.campaign = _.pick(campaign, '_id', 'code', 'name', 'type');
		if (campaign.targetQueue) {
			activity.queue = campaign.targetQueue;
		}
	}
	return activity;
}

var getFormName = function(formId) {
	response = HTTP.get('https://graph.facebook.com/v2.7/' + formId, { params: { access_token: Namespace.facebookApp.permanentAccessToken } });
	return response && response.data && response.data.name;
}

var getLeadData = function(leadId) {
	response = HTTP.get('https://graph.facebook.com/v2.7/' + leadId, { params: { access_token: Namespace.facebookApp.permanentAccessToken } });
	return response.data && response.data.field_data;
}

var getCampaign = function(formName) {
	if (formName) {
		findCampaign = {
			authTokenId: Namespace.facebookApp.authTokenId || Namespace.facebookApp.permanentAccessToken,
			document: 'Campaign',
			filter: {
				conditions: [{
					term: 'externalIdentifier',
					operator: 'equals',
					value: formName
				}],
			},
			limit: 1
		};
		var campaign = Meteor.call('data:find:all', findCampaign);
		if (campaign && campaign.data && campaign.data.length > 0) {
			return _.pick(campaign.data[0], '_id', 'code', 'name', 'type', 'targetQueue');
		}
	}
}

app.get('/facebook/leadgen', function(req, res, next) {
	if (req && req.query && req.query['hub.mode'] === 'subscribe') {
		MetaObject.update({ _id: 'Namespace' }, { $set: { 'facebookApp.verifyToken': req.query['hub.verify_token'] } });
		res.send(req.query['hub.challenge']);
	} else {
		res.send('');
	}
});

app.post('/facebook/leadgen', function(req, res, next) {
	var responses = [];
	if (Namespace && Namespace.facebookApp && Namespace.facebookApp.permanentAccessToken) {
		if (req.body && req.headers && req.headers["x-hub-signature"] === "sha1=" + crypto.createHmac('sha1', Namespace.facebookApp.secret).update(req.rawBody).digest('hex')) {
			if (req.body.entry && _.isArray(req.body.entry)) {
				req.body.entry.forEach(function(entry) {
					if (entry && entry.changes && _.isArray(entry.changes)) {
						entry.changes.forEach(function(change) {
							if (change && change.field === 'leadgen') {
								try {
									var formName = getFormName(change.value && change.value.form_id);
									var campaign = getCampaign(formName);
									if(campaign) {
										var leadData = getLeadData(change.value && change.value.leadgen_id);

										var contact = makeContact(leadData, campaign);
										var message = makeMessage(campaign, formName, getNotes(leadData));

										var contactData = {
											name: 'contact',
											data: contact
										};

										var messageData = {
											name: 'message',
											data: message,
											map: { contact: 'contact' }
										}

										var konectyRequest = {
											authTokenId: Namespace.facebookApp.authTokenId || Namespace.facebookApp.permanentAccessToken,
											data: [ contactData, messageData ]
										};

										if (Namespace.facebookApp.saveOpportunity) {
											var opportunity = makeOpportunity(campaign, formName, getNotes(leadData));
											var opportunityData = {
												name: 'opportunity',
												data: opportunity,
												map: { contact: 'contact' }
											};
											konectyRequest.data.push(opportunityData);
										}

										if (Namespace.facebookApp.saveActivity) {
											var activity = makeActivity(campaign, formName);
											var activityData = {
												name: 'activity',
												data: activity,
												map: { contact: 'contact' }
											};

											if (Namespace.facebookApp.saveOpportunity) {
												activityData.map['opportunity'] = 'opportunity';
											}

											konectyRequest.data.push(activityData);
										}

										if (Namespace.facebookApp.saveCampaignTarget && campaign) {
											var campaignTargetData = {
												name: 'campaignTarget',
												document: 'CampaignTarget',
												data: {
													campaign: campaign,
													status: 'Novo'
												},
												map: { contact: 'contact' }
											}

											if (Namespace.facebookApp.saveOpportunity) {
												campaignTargetData.map['opportunity'] = 'opportunity';
											}

											konectyRequest.data.push(campaignTargetData);
										}
										if (req.body.noProcess === true) {
											konectyRequest.leadgen = {
												formName: formName,
												leadData: leadData
											};
											responses.push(konectyRequest);
										} else {
											responses.push(Meteor.call('process:submit', konectyRequest));
										}
									}
								} catch (error) {
									console.log('Facebook incoming lead error', error);
									NotifyErrors.notify('FacebookIncomingLeadError', error, { request: req });
								}
							}
						});
					}
				});
			} else {
				NotifyErrors.notify('FacebookIncomingLeadError', 'Invalid request', { request: req });
				throw new Meteor.Error('invalid-request', 'Invalid request', req.body);
			}
		} else {
			NotifyErrors.notify('FacebookIncomingLeadError', 'Invalid signature', { request: req });
			throw new Meteor.Error('invalid-signature', 'Invalid signature');
		}
	} else {
		NotifyErrors.notify('FacebookIncomingLeadError', 'server-not-configured', { request: req });
		throw new Meteor.Error('server-not-configured');
	}
	res.send(responses);
});
