import { resolve, join } from 'path';
import { each } from 'async';
import { createTransport } from 'nodemailer';
import smtpTransport from 'nodemailer-smtp-transport';
import EmailTemplates from 'swig-email-templates';
import { createXOAuth2Generator } from 'xoauth2';
import { isObject, extend, omit, isEmpty, bind, get, has, join as _join, map } from 'lodash';

Templates = {};
const basePath = resolve('.').split('.meteor')[0];

let tplPath = 'packages/konsistent/private/templates/mail';

if (basePath.indexOf('bundle/programs/server') > 0) {
	tplPath = `../../programs/server/assets/${tplPath}`;
}

const emailTemplateOptions = {
	root: join(basePath, tplPath),
	filters: {
		upper: function(str) {
			return str.toUpperCase();
		}
	}
};

let namespace = undefined;

const transporters = {};

mailConsumer = {};

mailConsumer.sendEmail = function(record, cb) {
	let user;
	let email;
	let server = transporters.default;
	if (record.server) {
		if (transporters[record.server]) {
			server = transporters[record.server];
		} else if (record.server === 'googleApp') {
			if (get(record, '_user.length', 0) > 0 && has(namespace, 'googleApp.clientId') && has(namespace, 'googleApp.secret')) {
				user = Konsistent.Models['User'].findOne(record._user[0]._id, { fields: { name: 1, emails: 1, 'services.google': 1 } });

				// console.log 'IF -> user?.services?.google?.idToken ->',user?.services?.google?.idToken
				if (has(user, 'services.google.idToken')) {
					record.from = user.name + ' <' + get(user, 'emails.0.address') + '>';

					try {
						if (user.services.google.expiresAt < new Date()) {
							user.services.google = refreshUserToken(user._id, namespace.googleApp);

							console.log('new google data ->', user.services.google);
						}
					} catch (e) {
						NotifyErrors.notify('MailError', new Error("Couldn't refresh Google Token"), { record });
						Konsistent.Models['Message'].update({ _id: record._id }, { $set: { status: 'Falha no Envio', error: e } });
						console.log('📧 ', `Email error: ${JSON.stringify(e, null, ' ')}`.red);
						return cb();
					}

					if (has(user, 'services.google.idToken')) {
						console.log('GENERATOR -> user?.services?.google?.idToken ->', get(user, 'services.google'));
						const generator = createXOAuth2Generator({
							user: user.emails[0].address,
							clientId: namespace.googleApp.clientId,
							clientSecret: namespace.googleApp.secret,
							refreshToken: user.services.google.idToken,
							accessToken: user.services.google.accessToken
						});

						server = createTransport({
							service: 'gmail',
							auth: {
								xoauth2: generator
							},
							debug: true
						});
					}
				}
			}
		} else {
			NotifyErrors.notify('MailError', new Error(`Server ${record.server} not found`), { record });
		}
	} else {
		record.server = 'default';
	}

	if (isObject(get(namespace, 'emailServers')) && get(namespace, `emailServers.${record.server}.useUserCredentials`) === true) {
		user = Konsistent.Models['User'].findOne(record._user[0]._id, {
			fields: { name: 1, emails: 1, emailAuthLogin: 1, emailAuthPass: 1 }
		});
		console.log('IF -> user?.emailAuthLogin ->', get(user, 'emailAuthLogin'));
		if (has(user, 'emailAuthLogin')) {
			record.from = user.name + ' <' + get(user, 'emails.0.address') + '>';
			server = createTransport(
				extend({}, omit(namespace.emailServers[record.server], 'useUserCredentials'), {
					auth: { user: user.emailAuthLogin, pass: user.emailAuthPass }
				})
			);
		}
	}

	if ((!record.to || isEmpty(record.to)) && record.email) {
		record.to = _join(map(record.email, email => email.address), ',');
	}

	if ((!record.from || isEmpty(record.from)) && get(record, '_user.length', 0) > 0) {
		user = Konsistent.Models['User'].findOne(record._user[0]._id, { fields: { name: 1, emails: 1 } });

		record.from = user.name + ' <' + get(user, 'emails.0.address') + '>';
	}

	if (!record.to) {
		const err = { message: 'No address to send e-mail to.' };
		err.host = serverHost || record.server;
		NotifyErrors.notify('MailError', err, { err });
		Konsistent.Models['Message'].update({ _id: record._id }, { $set: { status: 'Falha no Envio', error: err } });
		console.log('📧 ', `Email error: ${JSON.stringify(err, null, ' ')}`.red);
		return cb();
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
			headers: record.headers || []
		};

		if (record.meta) {
			for (let name in record.meta) {
				const content = record.meta[name];
				mail.html += `<meta name='${name}' content='${content}'>`;
			}
		}

		if (process.env.KONECTY_MODE !== 'production') {
			mail.subject = `[DEV] [${mail.to}] ${mail.subject}`;
			mail.to = null; // 'team@konecty.com'
			mail.cc = null;
			mail.bcc = null;
		}

		if (mail.to) {
			if (server) {
				var serverHost = get(server, 'transporter.options.host');
				return server.sendMail(
					mail,
					Meteor.bindEnvironment(function(err, response) {
						if (err) {
							err.host = serverHost || record.server;
							NotifyErrors.notify('MailError', err, { mail, err });
							Konsistent.Models['Message'].update({ _id: record._id }, { $set: { status: 'Falha no Envio', error: err } });
							console.log('📧 ', `Email error: ${JSON.stringify(err, null, ' ')}`.red);
							return cb();
						}

						if (get(response, 'accepted.length') > 0) {
							if (record.discard === true) {
								Konsistent.Models['Message'].remove({ _id: record._id });
							} else {
								Konsistent.Models['Message'].update({ _id: record._id }, { $set: { status: record.sentStatus || 'Enviada' } });
							}
							console.log('📧 ', `Email sent to ${response.accepted.join(', ')} via [${serverHost || record.server}]`.green);
						}
						return cb();
					})
				);
			} else {
				console.log('📧 ', `There are no mail server configured`.red);
				console.log('📧 ', `Email NOT sent to ${mail.to}`.red);
				console.log(JSON.stringify(mail, null, 2));
				return cb();
			}
		} else {
			return cb();
		}
	}
};

mailConsumer.send = function(record, cb) {
	if (!record.template) {
		return mailConsumer.sendEmail(record, cb);
	}

	if (Templates[record.template]) {
		if (!record.subject) {
			record.subject = Templates[record.template].subject;
		}
		record.body = SSR.render(record.template, extend({ message: { _id: record._id } }, record.data));
		Konsistent.Models['Message'].update({ _id: record._id }, { $set: { body: record.body, subject: record.subject } });
		return mailConsumer.sendEmail(record, cb);
	}

	const emailTemplates = new EmailTemplates(emailTemplateOptions);
	if (!record.data) {
		record.data = {};
	}

	return emailTemplates.render(
		record.template,
		record.data,
		Meteor.bindEnvironment(function(err, html, text) {
			if (err) {
				NotifyErrors.notify('MailError', err, { record });
				Konsistent.Models['Message'].update({ _id: record._id }, { $set: { status: 'Falha no Envio', error: `${err}` } });
				console.log('📧 ', `Email error: ${err}`.red);
				return cb();
			}
			record.body = html;
			return mailConsumer.sendEmail(record, cb);
		})
	);
};

mailConsumer.consume = function() {
	if (!Konsistent.Models['Message']) {
		return;
	}

	mailConsumer.lockedAt = Date.now();
	const collection = Models.Message._getCollection();
	const findOneAndUpdate = Meteor.wrapAsync(bind(collection.findOneAndUpdate, collection));

	const query = {
		type: 'Email',
		status: { $in: ['Enviando', 'Send'] },
		$or: [{ sendAt: { $exists: 0 } }, { sendAt: { $lt: new Date() } }]
	};
	const sort = [];
	const update = { $set: { status: 'A Caminho' } };
	const options = {
		new: true,
		limit: 10,
		sort
	};

	const updatedRecords = findOneAndUpdate(query, update, options);
	const records = [];
	if (updatedRecords.value !== null) {
		records.push(updatedRecords.value);
	}

	if (records.length === 0) {
		setTimeout(Meteor.bindEnvironment(mailConsumer.consume), 1000);
		return;
	}

	return each(records, mailConsumer.send, () => mailConsumer.consume());
};

mailConsumer.start = function() {
	namespace = Konsistent.MetaObject.findOne({ _id: 'Namespace' });

	if (isObject(get(namespace, 'emailServers'))) {
		for (let key in namespace.emailServers) {
			const value = namespace.emailServers[key];
			if (!value.useUserCredentials) {
				console.log(`Setup email server [${key}]`.green);
				transporters[key] = createTransport(smtpTransport(value));
			}
		}
	}

	if (
		!transporters.default &&
		process.env.DEFAULT_SMTP_HOST &&
		process.env.DEFAULT_SMTP_PORT &&
		process.env.DEFAULT_SMTP_USERNAME &&
		process.env.DEFAULT_SMTP_PASSWORD
	) {
		const defaultSMTPConfig = {
			host: process.env.DEFAULT_SMTP_HOST,
			port: +process.env.DEFAULT_SMTP_PORT,
			auth: {
				user: process.env.DEFAULT_SMTP_USERNAME,
				pass: process.env.DEFAULT_SMTP_PASSWORD
			}
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

		console.log(`Setup default email server -> [${JSON.stringify(defaultSMTPConfig)}]`.green);
		transporters.default = createTransport(smtpTransport(defaultSMTPConfig));
	}

	mailConsumer.consume();
	return setInterval(function() {
		if (Date.now() - mailConsumer.lockedAt > 10 * 60 * 1000) {
			// 10 minutes
			return mailConsumer.consume();
		}
	}, 120000);
};
