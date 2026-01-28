import BluebirdPromise from 'bluebird';
import { CronJob } from 'cron';
import Mustache from 'mustache';

import { createTransport } from 'nodemailer';
import smtpTransport from 'nodemailer-smtp-transport';

import extend from 'lodash/extend';
import get from 'lodash/get';
import has from 'lodash/has';
import isEmpty from 'lodash/isEmpty';
import isObject from 'lodash/isObject';
import join from 'lodash/join';
import map from 'lodash/map';
import omit from 'lodash/omit';
import range from 'lodash/range';
import set from 'lodash/set';

import { MetaObject } from '@imports/model/MetaObject';
import { renderTemplate } from '../template';
import { logger } from '../utils/logger';
import { errorReturn, successReturn } from '../utils/return';
import { withTimeout } from '../utils/timeout';

const MAIL_CONSUME_SCHEDULE = process.env.MAIL_CONSUME_SCHEDULE || '*/1 * * * * *';
const SEND_EMAIL_TIMEOUT = Number(process.env.SEND_EMAIL_TIMEOUT ?? 30e3);
const TZ = process.env.TZ || 'America/Sao_Paulo';

const consumeCronJob = new CronJob(MAIL_CONSUME_SCHEDULE, consume, null, false, TZ);

const transporters = {};

async function sendEmail(record) {
	let user;
	let server = transporters.default;
	if (record.server) {
		if (transporters[record.server] != null) {
			server = transporters[record.server];
		} else {
			logger.error(`Server ${record.server} not found - Using default server`);
		}
	} else {
		record.server = 'default';
	}

	if (isObject(get(MetaObject.Namespace, 'emailServers')) && get(MetaObject.Namespace, `emailServers.${record.server}.useUserCredentials`) === true) {
		user = await MetaObject.Collections['User'].findOne(record._user[0]._id, {
			projection: { name: 1, emails: 1, emailAuthLogin: 1, emailAuthPass: 1 },
		});
		logger.debug('IF -> user?.emailAuthLogin ->', get(user, 'emailAuthLogin'));
		if (has(user, 'emailAuthLogin')) {
			record.from = user.name + ' <' + get(user, 'emails.0.address') + '>';
			server = createTransport(
				extend({}, omit(MetaObject.Namespace.emailServers[record.server], 'useUserCredentials'), {
					auth: { user: user.emailAuthLogin, pass: user.emailAuthPass },
				}),
			);
		}
	}

	if ((!record.to || isEmpty(record.to)) && record.email) {
		record.to = join(
			map(record.email, email => email.address),
			',',
		);
	}

	if ((!record.from || isEmpty(record.from)) && get(record, '_user.length', 0) > 0) {
		user = await MetaObject.Collections['User'].findOne(record._user[0]._id, { projection: { name: 1, emails: 1 } });

		record.from = user.name + ' <' + get(user, 'emails.0.address') + '>';
	}

	if (!record.to) {
		const err = { message: 'No address to send e-mail to.' };
		err.host = serverHost || record.server;
		await MetaObject.Collections['Message'].updateOne({ _id: record._id }, { $set: { status: 'Falha no Envio', error: err } });
		logger.error(`📧 Email error: ${JSON.stringify(err, null, ' ')}`);
		return errorReturn('No address to send e-mail to.');
	} else {
		const mail = {
			from: record.from,
			to: record.to,
			subject: record.subject,
			html: record.body,
			replyTo: record.replyTo,
			cc: record.cc,
			bcc: record.bcc,
			attachments: record.attachments,
			headers: record.headers || [],
		};

		if (record.meta) {
			for (let name in record.meta) {
				const content = record.meta[name];
				mail.html += `<meta name='${name}' content='${content}'>`;
			}
		}

		if (process.env.KONECTY_MODE !== 'production') {
			mail.subject = `[DEV] [${mail.to}] ${mail.subject}`;
			// mail.to = null; // 'team@konecty.com'
			mail.to = 'support@konecty.com';
			mail.cc = null;
			mail.bcc = null;
		}

		if (mail.to) {
			if (server) {
				var serverHost = get(server, 'transporter.options.host');
				try {
					logger.trace(`🔜 Sending email to ${mail.to} via [${serverHost || record.server}]`);
					const response = await server.sendMail(mail);

					if (get(response, 'accepted.length') > 0) {
						if (record.discard === true) {
							await MetaObject.Collections['Message'].deleteOne({ _id: record._id });
						} else {
							await MetaObject.Collections['Message'].updateOne({ _id: record._id }, { $set: { status: record.sentStatus || 'Enviada' } });
						}
						logger.info(`📧 Email sent to ${response.accepted.join(', ')} via [${serverHost || record.server}]`);
					}
				} catch (err) {
					logger.error(`📧 Email error: ${err.message}`);
					err.host = serverHost || record.server;
					await MetaObject.Collections['Message'].updateOne({ _id: record._id }, { $set: { status: 'Falha no Envio', error: err } });

					return errorReturn(err);
				}
			} else {
				logger.error(mail, `📧 There are no mail server configured, Email NOT sent`);
				await MetaObject.Collections['Message'].updateOne(
					{ _id: record._id },
					{ $set: { status: 'Falha no Envio', error: 'There are no mail server configured, Email NOT sent' } },
				);

				return errorReturn('There are no mail server configured, Email NOT sent');
			}
		} else {
			logger.error(mail, `📧 No address to send e-mail to.`);
			await MetaObject.Collections['Message'].updateOne({ _id: record._id }, { $set: { status: 'Falha no Envio', error: 'No address to send e-mail to.' } });
			return errorReturn('No address to send e-mail to.');
		}
	}

	return successReturn();
}

async function send(record) {
	if (!record.template) {
		return sendEmail(record);
	}

	if (/.+\.(hbs|html)$/.test(record.template) === true) {
		set(record, 'template', `email/${record.template}`);
	} else {
		const templateRecord = await MetaObject.Collections['Template'].findOne({ _id: record.template }, { projection: { subject: 1 } });

		if (templateRecord == null) {
			logger.error(`Template ${record.template} not found`);
			await MetaObject.Collections['Message'].updateOne(
				{ _id: record._id },
				{ $set: { status: 'Falha no Envio', error: { message: `Template ${record.template} not found` } } },
			);

			return errorReturn(`Template ${record.template} not found`);
		}
		record.subject = Mustache.render(templateRecord.subject, record.data);
	}

	try {
		record.body = await renderTemplate(record.template, extend({ message: { _id: record._id } }, record.data));
	} catch (error) {
		logger.error({ template: record.template, error: error.message }, 'Error rendering template');
		await MetaObject.Collections['Message'].updateOne({ _id: record._id }, { $set: { status: 'Falha no Envio', error: { message: error.message } } });
		return errorReturn(error.message);
	}

	await MetaObject.Collections['Message'].updateOne({ _id: record._id }, { $set: { body: record.body, subject: record.subject } });
	return sendEmail(record);
}

async function consume() {
	if (MetaObject.Collections['Message'] == null) {
		return;
	}

	consumeCronJob.stop();

	const query = {
		type: 'Email',
		status: { $in: ['Enviando', 'Send'] },
		$or: [{ sendAt: { $exists: 0 } }, { sendAt: { $lt: new Date() } }],
	};
	const sort = [];
	const update = { $set: { status: 'A Caminho' } };
	const options = {
		new: true,
		sort,
	};

	const mailCount = await MetaObject.Collections['Message'].countDocuments(query);

	if (mailCount === 0) {
		return consumeCronJob.start();
	}

	await BluebirdPromise.each(range(0, mailCount), async () => {
		try {
			await withTimeout(
				async () => {
					const updatedRecords = await MetaObject.Collections['Message'].findOneAndUpdate(query, update, options);

					if (updatedRecords == null || updatedRecords._id == null) {
						return;
					}

					return send(updatedRecords);
				},
				SEND_EMAIL_TIMEOUT,
				'consume->send',
			);
		} catch (error) {
			logger.error(error, `📧 Email error ${JSON.stringify(query, null, 2)}`);

			return errorReturn('message' in error ? error.message : 'Unknown error');
		}
	});

	return consumeCronJob.start();
}

export function start() {
	logger.info('Starting mail consumer');

	if (isObject(get(MetaObject.Namespace, 'emailServers'))) {
		for (let key in MetaObject.Namespace.emailServers) {
			const value = MetaObject.Namespace.emailServers[key];
			if (!value.useUserCredentials) {
				logger.info(`Setup email server [${key}]`);
				transporters[key] = createTransport(smtpTransport(value));
			}
		}
	}

	if (!transporters.default && process.env.DEFAULT_SMTP_HOST && process.env.DEFAULT_SMTP_PORT && process.env.DEFAULT_SMTP_USERNAME && process.env.DEFAULT_SMTP_PASSWORD) {
		const defaultSMTPConfig = {
			host: process.env.DEFAULT_SMTP_HOST,
			port: +process.env.DEFAULT_SMTP_PORT,
			auth: {
				user: process.env.DEFAULT_SMTP_USERNAME,
				pass: process.env.DEFAULT_SMTP_PASSWORD,
			},
		};

		if (process.env.DEFAULT_SMTP_SECURE) {
			defaultSMTPConfig.secure = process.env.DEFAULT_SMTP_SECURE === 'true';
		}

		if (process.env.DEFAULT_SMTP_TLS) {
			defaultSMTPConfig.tls = process.env.DEFAULT_SMTP_TLS;
		}

		if (process.env.DEFAULT_SMTP_IGNORE_TLS) {
			defaultSMTPConfig.ignoreTLS = process.env.DEFAULT_SMTP_IGNORE_TLS === 'true';
		}

		if (process.env.DEFAULT_SMTP_TLS_REJECT_UNAUTHORIZED) {
			defaultSMTPConfig.tls = { rejectUnauthorized: process.env.DEFAULT_SMTP_TLS_REJECT_UNAUTHORIZED === 'true' };
		}

		if (process.env.DEFAULT_SMTP_AUTH_METHOD) {
			defaultSMTPConfig.authMethod = process.env.DEFAULT_SMTP_AUTH_METHOD;
		}

		if (process.env.DEFAULT_SMTP_DEBUG) {
			defaultSMTPConfig.debug = process.env.DEFAULT_SMTP_DEBUG === 'true';
		}

		logger.info(`Setup default email server -> [${JSON.stringify(defaultSMTPConfig)}]`);
		transporters.default = createTransport(smtpTransport(defaultSMTPConfig));
	}

	consumeCronJob.start();
}
