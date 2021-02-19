import { DateTime } from 'luxon';

import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import extend from 'lodash/extend';
import pick from 'lodash/pick';

import { callMethod } from '@konecty/utils/methods';

import { Namespace } from '@konecty/metadata';

const init = app => {
	app.post('/rest/rocketchat/livechat', async function (req, res) {
		if (
			!req.headers['x-rocketchat-livechat-token'] ||
			!Namespace.RocketChat ||
			!Namespace.RocketChat.livechat ||
			req.headers['x-rocketchat-livechat-token'] !== Namespace.RocketChat.livechat.token
		) {
			res.statusCode = 403;
			return res.end();
		}

		let hookData = req.body;
		let result;
		let ddd = Namespace.ddd;
		if (process.env.KONECTY_MODE !== 'production') {
			console.log('RocketChak Hook ' + DateTime.local().toFormat('DD/MM/YYYY HH:mm:ss'), hookData.type);
			console.log('RocketChak Hook -> Visitor', JSON.stringify(hookData.visitor));
			console.log('RocketChak Hook -> Agent', JSON.stringify(hookData.agent));
			console.log('RocketChak Hook -> Message', JSON.stringify(hookData.messages));
		}
		let contactProcess, opportunityData, request;
		switch (hookData.type) {
			case 'LivechatSession':
			case 'LivechatEdit':
				contactProcess = {
					name: 'contact',
					data: {
						name: hookData.visitor.name || hookData.visitor.username,
					},
				};

				let messageExtraFields = {};

				if (hookData.visitor) {
					if (hookData.visitor.name && hookData.visitor.name.match(/guest/i)) {
						contactProcess.options = {
							doNotOverwriteName: true,
						};
					}

					if (!isEmpty(hookData.visitor.email)) {
						contactProcess.data.email = isArray(hookData.visitor.email) ? hookData.visitor.email[0].address : hookData.visitor.email;
					}

					if (!isEmpty(hookData.visitor.phone)) {
						let phoneTreatment = function (p) {
							let phone = s
								.trim(p)
								.replace(/[^0-9]/g, '')
								.replace(/^0+/g, '');
							if (phone.length <= 9 && phone.length >= 8) {
								phone = ddd + phone;
							}
							return phone;
						};

						let phone = [];

						if (isArray(hookData.visitor.phone)) {
							phone = hookData.visitor.phone.map(phone => phoneTreatment(phone.phoneNumber));
						} else {
							phone.push(phoneTreatment(hookData.visitor.phone));
						}
						contactProcess.data.phone = phone;
					}

					// Remove email if it is invalid
					// so it doesnt break the process/submit
					if (contactProcess.data.email != null && /^.+@.+\.[A-Za-z]{2,}(:?\.[A-Za-z]{2,})?$/.test(contactProcess.data.email) !== true) {
						contactProcess.data.email = null;
					}

					if (isEmpty(contactProcess.data.phone) && isEmpty(contactProcess.data.email)) {
						res.statusCode = 200;
						return res.end();
					}

					contactProcess.data.notes = '';

					if (!isEmpty(hookData.tags)) {
						contactProcess.data.notes += 'Tags: ' + hookData.tags.join(', ') + '\n';
					}

					if (!isEmpty(hookData.customFields) || !isEmpty(hookData.visitor.customFields)) {
						let customFields = extend(hookData.visitor.customFields || {}, hookData.customFields || {});
						for (let customField in customFields) {
							if (customFields.hasOwnProperty(customField) && !isEmpty(customFields[customField])) {
								switch (customField) {
									case 'campaign':
										contactProcess.data.campaign = {
											identifier: customFields[customField],
										};
										break;
									case 'channel':
										contactProcess.data.channel = {
											identifier: customFields[customField],
										};
										break;
									case 'medium':
										contactProcess.data.medium = customFields[customField];
										break;
									case 'referrerURL':
										contactProcess.data.referrerURL = customFields[customField];
										break;
									case 'source':
										contactProcess.data.source = {
											identifier: customFields[customField],
										};
										messageExtraFields['source'] = { identifier: customFields[customField] };
										break;
									case 'development':
										messageExtraFields['development'] = { _id: customFields[customField] };
										break;
									case 'product':
										messageExtraFields['product'] = { _id: customFields[customField] };
										break;
									default:
										contactProcess.data.notes += customField + ': ' + customFields[customField] + '\n';
								}
							}
						}
					}
				}

				contactProcess.data.user = {
					_id: hookData.agent._id,
				};

				if (hookData.visitor.department) {
					contactProcess.data.queue = { _id: hookData.visitor.department };
				} else if (Namespace.RocketChat.livechat.queue) {
					contactProcess.data.queue = Namespace.RocketChat.livechat.queue;
				}

				if (!contactProcess.data.campaign && Namespace.RocketChat.livechat.campaign) {
					contactProcess.data.campaign = Namespace.RocketChat.livechat.campaign;
				}

				opportunityData = {
					name: 'opportunity',
					data: {},
					map: {
						contact: 'contact',
					},
				};

				if (contactProcess.data.campaign) {
					opportunityData.data.campaign = contactProcess.data.campaign;
				}
				if (contactProcess.data.channel) {
					opportunityData.data.channel = contactProcess.data.channel;
				}
				if (contactProcess.data.medium) {
					opportunityData.data.medium = contactProcess.data.medium;
				}
				if (contactProcess.data.referrerURL) {
					opportunityData.data.referrerURL = contactProcess.data.referrerURL;
				}
				if (contactProcess.data.source) {
					opportunityData.data.source = contactProcess.data.source;
				}

				if (hookData.visitor.department) {
					opportunityData.data.queue = { _id: hookData.visitor.department };
				} else if (Namespace.RocketChat.livechat.queue) {
					opportunityData.data.queue = Namespace.RocketChat.livechat.queue;
				}

				let messages = '';
				if (hookData.messages) {
					hookData.messages.forEach(function (msg) {
						messages += '<strong>' + msg.username + '</strong> (' + DateTime.fromJSDate(msg.ts).toFormat('DD/MM/YYYY HH:mm:ss') + '): ' + msg.msg + '<br><br>\n\n';
					});

					let messageData = {
						name: 'message',
						data: {
							status: 'Nova',
							priority: 'Média',
							type: 'Livechat',
							subject: 'Cópia de Livechat - Código ' + hookData.code,
							body: messages,
						},
						map: {
							contact: 'contact',
							opportunity: 'opportunity',
						},
					};

					if (contactProcess.data.campaign) {
						messageData.data.campaign = contactProcess.data.campaign;
					}
					if (contactProcess.data.channel) {
						messageData.data.channel = contactProcess.data.channel;
					}
					if (contactProcess.data.medium) {
						messageData.data.medium = contactProcess.data.medium;
					}

					Object.keys(messageExtraFields).forEach(function (key) {
						messageData.data[key] = messageExtraFields[key];
					});
				}

				if (hookData.crmData) {
					Object.keys(hookData.crmData).forEach(function (key) {
						if (key === 'contact') {
							if (hookData.crmData[key]._id) {
								contactProcess.data._id = hookData.crmData[key]._id;
							}
							if (hookData.crmData[key].code) {
								contactProcess.data.code = hookData.crmData[key].code;
							}
						} else if (key === 'opportunity') {
							if (hookData.crmData[key]._id) {
								opportunityData.data._id = hookData.crmData[key]._id;
							}
							if (hookData.crmData[key].code) {
								opportunityData.data.code = hookData.crmData[key].code;
							}
						} else if (key === 'message') {
							if (hookData.crmData[key]._id) {
								messageData.data._id = hookData.crmData[key]._id;
							}
							if (hookData.crmData[key].code) {
								messageData.data.code = hookData.crmData[key].code;
							}
						}
					});
				}

				let activity = {
					name: 'activity',
					data: {
						status: 'Concluída',
						subject: 'Chat',
						priority: 'Média',
						type: 'Contato',
					},
					map: {
						opportunity: 'opportunity',
						contact: 'contact',
					},
				};

				if (contactProcess.data.campaign.identifier) {
					contactProcess.data.campaign._id = contactProcess.data.campaign.identifier;
				}

				request = {
					authTokenId: Namespace.RocketChat.accessToken,
					data: [contactProcess, opportunityData, messageData, activity],
				};

				result = await callMethod('process:submit', request);
				break;

			case 'LivechatOfflineMessage':
				contactProcess = {
					name: 'contact',
					data: {
						name: hookData.visitor.name,
					},
				};

				if (!isEmpty(hookData.visitor.email)) {
					contactProcess.data.email = hookData.visitor.email;
				}

				if (Namespace.RocketChat.livechat.queue) {
					contactProcess.data.queue = Namespace.RocketChat.livechat.queue;
				}

				if (!contactProcess.data.campaign && Namespace.RocketChat.livechat.campaign) {
					contactProcess.data.campaign = Namespace.RocketChat.livechat.campaign;
				}

				opportunityData = {
					name: 'opportunity',
					data: {},
					map: {
						contact: 'contact',
					},
				};

				if (Namespace.RocketChat.livechat.queue) {
					opportunityData.data.queue = Namespace.RocketChat.livechat.queue;
				}

				let messageData = {
					name: 'message',
					data: {
						status: 'Nova',
						priority: 'Média',
						type: 'Formulário Web',
						subject: 'Formulário Livechat',
						body: hookData.message.replace(/([\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + '<br>' + '$2'),
					},
					map: {
						contact: 'contact',
						opportunity: 'opportunity',
					},
				};

				request = {
					authTokenId: Namespace.RocketChat.accessToken,
					data: [contactProcess, opportunityData, messageData],
				};

				if (Namespace.RocketChat.livechat.saveCampaignTarget && Namespace.RocketChat.livechat.campaign) {
					let campaignTargetData = {
						name: 'campaignTarget',
						document: 'CampaignTarget',
						data: {
							campaign: Namespace.RocketChat.livechat.campaign,
							status: 'Novo',
						},
						map: {
							contact: 'contact',
							opportunity: 'opportunity',
						},
					};

					request.data.push(campaignTargetData);
				}

				result = await callMethod('process:submit', request);
				break;

			default:
				res.statusCode = 400;
				return res.end();
		}

		if (process.env.KONECTY_MODE !== 'production') {
			console.log('RocketChak result ' + DateTime.local().toFormat('DD/MM/YYYY HH:mm:ss'), JSON.stringify(result));
		}

		let response = { success: result.success };

		if (result.success) {
			let processData = {};

			// get _id from all saved documents
			Object.keys(result.processData).forEach(function (key) {
				if (result.processData[key]._id) {
					processData[key] = pick(result.processData[key], '_id', 'code');
				}
			});

			response.data = processData;
		}

		return res.send(response);
	});

	app.get('/rest/rocketchat/livechat/queue', async function (req, res) {
		if (
			!req.headers['x-rocketchat-secret-token'] ||
			!Namespace.RocketChat ||
			!Namespace.RocketChat.livechat ||
			req.headers['x-rocketchat-secret-token'] !== Namespace.RocketChat.livechat.token
		) {
			res.statusCode = 403;
			return res.end();
		}

		let departmentId = req.query.departmentId;
		let queue;
		if (departmentId) {
			let queueQuery = {
				$or: [{ _id: departmentId }, { name: departmentId }],
			};

			queue = await Models.Queue.findOne(queueQuery, { fields: { _id: 1, active: 1 } });
			if (queue) {
				departmentId = queue._id;
			} else {
				departmentId = null;
			}
			if (queue && !queue.active) {
				res.writeHead(400, { 'Content-Type': 'application/json' });
				return res.send('{ "success": false, "error": "Queue not active" }');
			}
		}

		if (!departmentId && Namespace.RocketChat.livechat.queue) {
			departmentId = Namespace.RocketChat.livechat.queue;
		}

		if (!departmentId) {
			res.writeHead(400, { 'Content-Type': 'application/json' });
			return res.send('{ "success": false, "error": "Queue not found" }');
		}

		const nextAgent = await callMethod('data:queue:next', {
			authTokenId: Namespace.RocketChat.accessToken,
			document: 'Queue',
			queueId: departmentId,
		});

		if (nextAgent.success && nextAgent.user && nextAgent.user.user && nextAgent.user.user._id) {
			const user = await Models.User.findOne(nextAgent.user.user._id, { fields: { username: 1 } });
			return res.send(user);
		}

		return res.send();
	});
};

export { init };
