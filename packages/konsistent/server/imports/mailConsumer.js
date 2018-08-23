/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// import Konsistent from './';

this.Templates = {};

const path = require('path');
const async = require('async');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const emailTemplates = require('swig-email-templates');
const xoauth2 = require('xoauth2');
const _ = require('lodash');

const basePath = path.resolve('.').split('.meteor')[0];

let tplPath = 'packages/konsistent/private/templates/mail';

if (basePath.indexOf('bundle/programs/server') > 0) {
	tplPath = `../../programs/server/assets/${tplPath}`;
}

const emailTemplateOptions =
	{root: path.join(basePath, tplPath)};

let namespace = undefined;

const transporters = {};

this.mailConsumer = {};

mailConsumer.sendEmail = function(record, cb) {
	let user;
	let email;
	let server = transporters.default;
	if (record.server != null) {
		if (transporters[record.server] != null) {
			server = transporters[record.server];
		} else if (record.server === 'googleApp') {
			if (((record._user != null ? record._user.length : undefined) > 0) && (__guard__(namespace != null ? namespace.googleApp : undefined, x => x.clientId) != null) && (__guard__(namespace != null ? namespace.googleApp : undefined, x1 => x1.secret) != null)) {
				user = Konsistent.Models['User'].findOne(record._user[0]._id, { fields: { name: 1, emails: 1, 'services.google': 1 }});

				// console.log 'IF -> user?.services?.google?.idToken ->',user?.services?.google?.idToken
				if (__guard__(__guard__(user != null ? user.services : undefined, x3 => x3.google), x2 => x2.idToken) != null) {
					record.from = user.name + ' <' + (user.emails[0] != null ? user.emails[0].address : undefined) + '>';

					try {
						if (user.services.google.expiresAt < new Date()) {
							user.services.google = refreshUserToken(user._id, namespace.googleApp);

							console.log('new google data ->',user.services.google);
						}
					} catch (e) {
						NotifyErrors.notify('MailError', (new Error("Couldn't refresh Google Token")), {record});
						Konsistent.Models['Message'].updateOne({_id: record._id}, {$set: {status: 'Falha no Envio', error: e}});
						console.log('📧 ', `Email error: ${JSON.stringify(e, null, ' ')}`.red);
						return cb();
					}

					if (__guard__(__guard__(user != null ? user.services : undefined, x5 => x5.google), x4 => x4.idToken) != null) {
						console.log('GENERATOR -> user?.services?.google?.idToken ->',__guard__(user != null ? user.services : undefined, x6 => x6.google));
						const generator = xoauth2.createXOAuth2Generator({
							user: user.emails[0].address,
							clientId: namespace.googleApp.clientId,
							clientSecret: namespace.googleApp.secret,
							refreshToken: user.services.google.idToken,
							accessToken: user.services.google.accessToken
						});

						server = nodemailer.createTransport({
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
			NotifyErrors.notify('MailError', (new Error(`Server ${record.server} not found`)), {record});
		}
	} else {
		record.server = 'default';
	}

	if (_.isObject(namespace != null ? namespace.emailServers : undefined) && ((namespace.emailServers[record.server] != null ? namespace.emailServers[record.server].useUserCredentials : undefined) === true)) {
		user = Konsistent.Models['User'].findOne(record._user[0]._id, { fields: { name: 1, emails: 1, emailAuthLogin: 1, emailAuthPass: 1 }});
		console.log('IF -> user?.emailAuthLogin ->', user != null ? user.emailAuthLogin : undefined);
		if (user != null ? user.emailAuthLogin : undefined) {
			record.from = user.name + ' <' + (user.emails[0] != null ? user.emails[0].address : undefined) + '>';
			server = nodemailer.createTransport(_.extend({}, _.omit(namespace.emailServers[record.server], 'useUserCredentials'), { auth: { user: user.emailAuthLogin, pass: user.emailAuthPass } }));
		}
	}

	if (((record.to == null) || _.isEmpty(record.to)) && (record.email != null)) {
		record.to = ((() => {
			const result = [];
			for (email of Array.from([].concat(record.email))) { 				result.push(email.address);
			}
			return result;
		})()).join(',');
	}

	if (((record.from == null) || _.isEmpty(record.from)) && ((record._user != null ? record._user.length : undefined) > 0)) {
		user = Konsistent.Models['User'].findOne(record._user[0]._id, { fields: { name: 1, emails: 1 }});

		record.from = user.name + ' <' + (user.emails[0] != null ? user.emails[0].address : undefined) + '>';
	}

	if (!record.to) {
		const err = { message: 'No address to send e-mail to.' };
		err.host = serverHost || record.server;
		NotifyErrors.notify('MailError', err, {err});
		Konsistent.Models['Message'].updateOne({_id: record._id}, {$set: {status: 'Falha no Envio', error: err}});
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
			var serverHost = __guard__(__guard__(server != null ? server.transporter : undefined, x8 => x8.options), x7 => x7.host);
			return server.sendMail(mail, Meteor.bindEnvironment(function(err, response) {
				if (err != null) {
					err.host = serverHost || record.server;
					NotifyErrors.notify('MailError', err, {mail, err});
					Konsistent.Models['Message'].updateOne({_id: record._id}, {$set: {status: 'Falha no Envio', error: err}});
					console.log('📧 ', `Email error: ${JSON.stringify(err, null, ' ')}`.red);
					return cb();
				}

				if ((response != null ? response.accepted.length : undefined) > 0) {
					if (record.discard === true) {
						Konsistent.Models['Message'].remove({_id: record._id});
					} else {
						Konsistent.Models['Message'].updateOne({ _id: record._id }, { $set: { status: record.sentStatus || 'Enviada' } });
					}
					console.log('📧 ', `Email sent to ${response.accepted.join(', ')} via [${serverHost || record.server}]`.green);
				}
				return cb();
			})
			);
		} else {
			return cb();
		}
	}
};

mailConsumer.send = function(record, cb) {
	if ((record.template == null)) {
		return mailConsumer.sendEmail(record, cb);
	}

	if (Templates[record.template] != null) {
		if (record.subject == null) { record.subject = Templates[record.template].subject; }
		record.body = SSR.render(record.template, _.extend({ message: { _id: record._id } }, record.data));
		Konsistent.Models['Message'].updateOne({ _id: record._id }, { $set: { body: record.body, subject: record.subject } });
		return mailConsumer.sendEmail(record, cb);
	}

	return emailTemplates(emailTemplateOptions, Meteor.bindEnvironment(function(err, render) {
		if (err != null) {
			NotifyErrors.notify('MailError', err);
			Konsistent.Models['Message'].updateOne({_id: record._id}, {$set: {status: 'Falha no Envio', error: err}});
			return cb();
		}

		if (record.data == null) { record.data = {}; }

		return render(record.template, record.data, Meteor.bindEnvironment(function(err, html, text) {
			if (err != null) {
				NotifyErrors.notify('MailError', err, {record});
				Konsistent.Models['Message'].updateOne({_id: record._id}, {$set: {status: 'Falha no Envio', error: err}});
				return cb();
			}

			record.body = html;

			return mailConsumer.sendEmail(record, cb);
		})
		);
	})
	);
};

mailConsumer.consume = function() {
	if (Konsistent.Models['Message'] == null) { return; }
	
	mailConsumer.lockedAt = Date.now();
	const collection = Models.Message._getCollection();
	const findOneAndUpdate = Meteor.wrapAsync(_.bind(collection.findOneAndUpdate, collection));

	const query = {
		type: 'Email',
		status: { $in: [ 'Enviando', 'Send' ] },
		$or: [
			{ sendAt: { $exists: 0 } },
			{ sendAt: { $lt: new Date } }
		]
	};
	const sort = [];
	const update = 
		{$set: { status: 'A Caminho' }};
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
		
	return async.each(records, mailConsumer.send, () => mailConsumer.consume());
};

mailConsumer.start = function() {
	namespace = Konsistent.MetaObject.findOne({_id: 'Namespace'});

	if (_.isObject(namespace != null ? namespace.emailServers : undefined)) {
		for (let key in namespace.emailServers) {
			const value = namespace.emailServers[key];
			if (!value.useUserCredentials) {
				console.log(`Setup email server [${key}]`.green);
				transporters[key] = nodemailer.createTransport(smtpTransport(value));
			}
		}
	}

	if ((transporters.default == null) && (process.env.DEFAULT_SMTP_HOST != null) && (process.env.DEFAULT_SMTP_PORT != null) && (process.env.DEFAULT_SMTP_USERNAME != null) && (process.env.DEFAULT_SMTP_PASSWORD != null)) {
		const defaultSMTPConfig = {
			host: process.env.DEFAULT_SMTP_HOST,
			port: +process.env.DEFAULT_SMTP_PORT,
			auth: {
				user: process.env.DEFAULT_SMTP_USERNAME,
				pass: process.env.DEFAULT_SMTP_PASSWORD
			}
		};

		if (process.env.DEFAULT_SMTP_SECURE != null) {
			defaultSMTPConfig.secure = process.env.DEFAULT_SMTP_SECURE === 'true';
		}

		if (process.env.DEFAULT_SMTP_TLS != null) {
			defaultSMTPConfig.tls = process.env.DEFAULT_SMTP_TLS;
		}

		if (process.env.DEFAULT_SMTP_IGNORE_TLS != null) {
			defaultSMTPConfig.ignoreTLS = process.env.DEFAULT_SMTP_IGNORE_TLS === 'true';
		}
		
		if (process.env.DEFAULT_SMTP_TLS_REJECT_UNAUTHORIZED != null) {
			defaultSMTPConfig.tls =
				{rejectUnauthorized: process.env.DEFAULT_SMTP_TLS_REJECT_UNAUTHORIZED === 'true'};
		}

		if (process.env.DEFAULT_SMTP_AUTH_METHOD != null) {
			defaultSMTPConfig.authMethod = process.env.DEFAULT_SMTP_AUTH_METHOD;
		}
		
		if (process.env.DEFAULT_SMTP_DEBUG != null) {
			defaultSMTPConfig.debug = process.env.DEFAULT_SMTP_DEBUG === 'true';
		}
		
		console.log(`Setup default email server -> [${JSON.stringify(defaultSMTPConfig)}]`.green);
		transporters.default = nodemailer.createTransport(smtpTransport(defaultSMTPConfig));
	}

	mailConsumer.consume();
	return setInterval(function() {
		if ((Date.now() - mailConsumer.lockedAt) > (10 * 60 * 1000)) { // 10 minutes
			return mailConsumer.consume();
		}
	}
	, 120000);
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}