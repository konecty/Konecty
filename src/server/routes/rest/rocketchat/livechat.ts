import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import moment from 'moment';

import { ObjectId } from 'mongodb';
import isEmpty from 'lodash/isEmpty';
import isArray from 'lodash/isArray';
import extend from 'lodash/extend';
import pick from 'lodash/pick';
import get from 'lodash/get';
import set from 'lodash/set';

import { MetaObject } from '@imports/model/MetaObject';
import { processSubmit } from '@imports/data/process';
import { getNextUserFromQueue } from '@imports/meta/getNextUserFromQueue';
import { getUserSafe } from '@imports/auth/getUser';
import { logger } from '@imports/utils/logger';

const rocketchatApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.post<{
		Body: {
			type: string;
			code: string;
			visitor: {
				name: string;
				username: string;
				email: string;
				phone: string;
				department: string;
				customFields: unknown;
			};
			tags?: string[];
			customFields?: unknown;
			agent: {
				_id: string;
			};
			messages?: {
				username: string;
				ts: string;
				msg: string;
			}[];
			crmData?: {
				contact?: {
					_id: string;
					code: number;
				};
				opportunity?: {
					_id: string;
					code: number;
				};
				message?: {
					_id: string;
					code: number;
				};
			};
			message?: string;
		};
	}>('/rest/rocketchat/livechat', async function (req, reply) {
		if (req.headers['x-rocketchat-livechat-token'] == null) {
			return reply.status(403).send('Forbidden');
		}
		if (get(MetaObject.Namespace, 'RocketChat.livechat.token', 'not-set') !== req.headers['x-rocketchat-livechat-token']) {
			return reply.status(403).send('Forbidden');
		}

		const hookData = req.body;
		let result: {
			success: boolean;
			processData?: any;
		} = {
			success: false,
		};

		const ddd = get(MetaObject.Namespace, 'ddd', '11');
		switch (hookData.type) {
			case 'LivechatSession':
			case 'LivechatEdit':
				const contactProcess: {
					name: string;
					data: {
						_id?: string;
						code?: number;
						name: string;
						email?: string | null;
						phone?: string[];
						notes?: string;
						user?: {
							_id: string;
						};
						queue?: {
							_id: string;
						};
						campaign?: {
							_id: string;
							identifier: string;
						};
						channel?: {
							identifier: string;
						};
						medium?: string;
						referrerURL?: string;
						source?: {
							identifier: string;
						};
					};
					options?: {
						doNotOverwriteName?: boolean;
					};
				} = {
					name: 'contact',
					data: {
						name: hookData.visitor.name || hookData.visitor.username,
					},
				};

				const messageExtraFields = {};

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
						const phoneTreatment = function (p: string) {
							let phone = p
								.trim()
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
						return reply.status(400).send('Bad Request');
					}

					contactProcess.data.notes = '';

					if (hookData.tags != null && !isEmpty(hookData.tags)) {
						contactProcess.data.notes += 'Tags: ' + hookData.tags.join(', ') + '\n';
					}

					if (!isEmpty(hookData.customFields) || !isEmpty(hookData.visitor.customFields)) {
						const customFields = extend(hookData.visitor.customFields || {}, hookData.customFields || {}) as any;
						for (const customField in customFields) {
							const value = get(customFields, customField, null);
							// eslint-disable-next-line no-prototype-builtins
							if (customFields.hasOwnProperty(customField) && !isEmpty(value)) {
								switch (customField) {
									case 'campaign':
										contactProcess.data.campaign = {
											_id: value,
											identifier: value,
										} as any;
										break;
									case 'channel':
										contactProcess.data.channel = {
											identifier: value,
										} as any;
										break;
									case 'medium':
										set(contactProcess, 'data.medium', value);
										break;
									case 'referrerURL':
										set(contactProcess, 'data.referrerURL', value);
										break;
									case 'source':
										contactProcess.data.source = {
											identifier: value,
										} as any;
										set(messageExtraFields, 'source', { identifier: value });
										break;
									case 'development':
										set(messageExtraFields, 'development', { _id: value });
										break;
									case 'product':
										set(messageExtraFields, 'product', { _id: value });
										break;
									default:
										contactProcess.data.notes += customField + ': ' + value + '\n';
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
				} else if (get(MetaObject.Namespace, 'RocketChat.livechat.queue') != null) {
					contactProcess.data.queue = get(MetaObject.Namespace, 'RocketChat.livechat.queue');
				}

				if (contactProcess.data.campaign == null && get(MetaObject.Namespace, 'RocketChat.livechat.campaign') != null) {
					contactProcess.data.campaign = get(MetaObject.Namespace, 'RocketChat.livechat.campaign');
				}

				const opportunityData: {
					name: string;
					data: {
						_id?: string;
						code?: number;
						campaign?: {
							_id: string;
							identifier: string;
						};
						channel?: {
							identifier: string;
						};
						medium?: string;
						referrerURL?: string;
						source?: {
							identifier: string;
						};
						queue?: {
							_id: string;
						};
					};
					map?: {
						contact: string;
					};
				} = {
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
				} else if (get(MetaObject.Namespace, 'RocketChat.livechat.queue') != null) {
					opportunityData.data.queue = get(MetaObject.Namespace, 'RocketChat.livechat.queue');
				}

				let messages = '';
				let messageData: {
					name?: string;
					data: {
						_id?: string;
						code?: number;
						status?: string;
						priority?: string;
						type?: string;
						subject?: string;
						body?: string;
						campaign?: {
							_id: string;
							identifier: string;
						};
						channel?: {
							identifier: string;
						};
						medium?: string;
						referrerURL?: string;
						source?: {
							identifier: string;
						};
						queue?: {
							_id: string;
						};
					};
					map?: {
						contact: string;
						opportunity: string;
					};
				} = { data: {} };

				if (hookData.messages) {
					hookData.messages.forEach(function (msg) {
						messages += '<strong>' + msg.username + '</strong> (' + moment(msg.ts).format('DD/MM/YYYY HH:mm:ss') + '): ' + msg.msg + '<br><br>\n\n';
					});

					messageData = {
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
						set(messageData, 'data.' + key, get(messageExtraFields, key));
					});
				}

				if (hookData.crmData != null) {
					Object.entries(hookData.crmData).forEach(function ([key, value]) {
						if (key === 'contact') {
							if (value._id != null) {
								contactProcess.data._id = value._id;
							}
							if (value.code != null) {
								contactProcess.data.code = value.code;
							}
						} else if (key === 'opportunity') {
							if (value._id != null) {
								opportunityData.data._id = value._id;
							}
							if (value.code != null) {
								opportunityData.data.code = value.code;
							}
						} else if (key === 'message') {
							if (value._id != null) {
								messageData.data._id = value._id;
							}
							if (value.code != null) {
								messageData.data.code = value.code;
							}
						}
					});
				}

				const activity: {
					name: string;
					data: {
						status: string;
						subject: string;
						priority: string;
						type: string;
						realEstateInterest?: boolean;
						campaign?: {
							_id: string;
							identifier: string;
						};
						channel?: {
							identifier: string;
						};
						medium?: string;
						referrerURL?: string;
						source?: {
							identifier: string;
						};
						queue?: {
							_id: string;
						};
					};
					map?: {
						opportunity: string;
						contact: string;
					};
				} = {
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

				if (contactProcess.data.campaign) {
					activity.data.campaign = contactProcess.data.campaign;
				}
				if (contactProcess.data.channel) {
					activity.data.channel = contactProcess.data.channel;
				}
				if (contactProcess.data.medium) {
					activity.data.medium = contactProcess.data.medium;
				}
				if (contactProcess.data.queue != null) {
					activity.data.queue = contactProcess.data.queue;
				}

				if (MetaObject.Meta['Activity'] != null) {
					if (MetaObject.Meta.Activity?.fields?.realEstateInterest != null) {
						activity.data.realEstateInterest = true;
					}
				}

				const contextUserResult = await getUserSafe(MetaObject.Namespace.RocketChat.accessToken);

				if (contextUserResult.success === false) {
					logger.error(contextUserResult, 'Error getting user from token');
					return reply.status(401).send('Unauthorized');
				}

				const request = {
					authTokenId: MetaObject.Namespace.RocketChat.accessToken,
					data: [contactProcess, opportunityData, messageData, activity],
					contextUser: contextUserResult.data,
				};

				result = await processSubmit(request);
				break;

			case 'LivechatOfflineMessage':
				const contactOfflineProcess: {
					name: string;
					data: {
						name: string;
						email?: string;
						queue?: {
							_id: string;
						};
						campaign?: {
							_id: string;
							identifier: string;
						};
					};
				} = {
					name: 'contact',
					data: {
						name: hookData.visitor.name,
					},
				};

				if (!isEmpty(hookData.visitor.email)) {
					contactOfflineProcess.data.email = hookData.visitor.email;
				}

				if (MetaObject.Namespace.RocketChat.livechat.queue) {
					contactOfflineProcess.data.queue = MetaObject.Namespace.RocketChat.livechat.queue;
				}

				if (!contactOfflineProcess.data.campaign && MetaObject.Namespace.RocketChat.livechat.campaign) {
					contactOfflineProcess.data.campaign = MetaObject.Namespace.RocketChat.livechat.campaign;
				}

				const opportunityOfflineData: {
					name: string;
					data: {
						campaign?: {
							_id: string;
							identifier: string;
						};
						queue?: {
							_id: string;
						};
					};
					map?: {
						contact: string;
					};
				} = {
					name: 'opportunity',
					data: {},
					map: {
						contact: 'contact',
					},
				};

				if (MetaObject.Namespace.RocketChat.livechat.queue) {
					opportunityOfflineData.data.queue = MetaObject.Namespace.RocketChat.livechat.queue;
				}

				const messageOfflineData = {
					name: 'message',
					data: {
						status: 'Nova',
						priority: 'Média',
						type: 'Formulário Web',
						subject: 'Formulário Livechat',
						body: (hookData.message ?? '').replace(/([\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + '<br>' + '$2'),
					},
					map: {
						contact: 'contact',
						opportunity: 'opportunity',
					},
				};

				const submitRequest = {
					authTokenId: MetaObject.Namespace.RocketChat.accessToken,
					data: [contactOfflineProcess, opportunityOfflineData, messageOfflineData],
				};

				if (MetaObject.Namespace.RocketChat.livechat.saveCampaignTarget && MetaObject.Namespace.RocketChat.livechat.campaign) {
					const campaignTargetData = {
						name: 'campaignTarget',
						document: 'CampaignTarget',
						data: {
							campaign: MetaObject.Namespace.RocketChat.livechat.campaign,
							status: 'Novo',
						},
						map: {
							contact: 'contact',
							opportunity: 'opportunity',
						},
					};

					submitRequest.data.push(campaignTargetData);
				}

				result = await processSubmit(submitRequest as any);
				break;

			default:
				return reply.status(400).send('Bad Request');
		}

		const response: {
			success: boolean;
			data?: any;
		} = { success: result.success };

		if (result.success) {
			const processData = {};

			// get _id from all saved documents
			Object.keys(result.processData).forEach(function (key) {
				if (result.processData[key]._id) {
					set(processData, key, pick(result.processData[key], '_id', 'code'));
				}
			});

			response.data = processData;
		}

		return reply.send(response);
	});

	fastify.get<{
		Params: {
			query: {
				departmentId: string;
			};
		};
		Querystring: {
			departmentId: string;
		};
	}>('/rest/rocketchat/livechat/queue', async function (req, reply) {
		if (
			!req.headers['x-rocketchat-secret-token'] ||
			!MetaObject.Namespace.RocketChat ||
			!MetaObject.Namespace.RocketChat.livechat ||
			req.headers['x-rocketchat-secret-token'] !== MetaObject.Namespace.RocketChat.livechat.token
		) {
			return reply.status(403).send('Forbidden');
		}

		let departmentId: ObjectId | string | null = req.query.departmentId;

		if (departmentId != null) {
			const queueQuery = {
				$or: [{ _id: departmentId }, { name: departmentId }],
			} as any;

			const queue = await MetaObject.Collections['Queue'].findOne(queueQuery, { projection: { _id: 1, active: 1 } });
			if (queue) {
				departmentId = queue._id;
			} else {
				departmentId = null;
			}
			if (queue && !queue.active) {
				return reply.status(400).send({ success: false, error: 'Queue not active' });
			}
		}

		if (!departmentId && MetaObject.Namespace.RocketChat.livechat.queue) {
			departmentId = MetaObject.Namespace.RocketChat.livechat.queue;
		}

		if (!departmentId) {
			return reply.status(400).send({ success: false, error: 'Queue not found' });
		}

		const contextUser = await getUserSafe(MetaObject.Namespace.RocketChat.accessToken);

		if (contextUser.success === false) {
			logger.error(contextUser, 'Error getting user from token');
			return reply.send();
		}

		const nextAgent = await getNextUserFromQueue(departmentId, contextUser.data);

		if (nextAgent.success === true && nextAgent?.data?.user?._id) {
			const user = await MetaObject.Collections['User'].findOne({ _id: nextAgent.data.user._id }, { projection: { username: 1 } });
			return reply.send(user);
		}

		return reply.send();
	});

	done();
};

export default fp(rocketchatApi);
