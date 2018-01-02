@Templates = {}

path = Npm.require 'path'
async = Npm.require 'async'
nodemailer = Npm.require 'nodemailer'
smtpTransport = Npm.require 'nodemailer-smtp-transport'
emailTemplates = Npm.require 'swig-email-templates'
xoauth2 = Npm.require 'xoauth2'

basePath = path.resolve('.').split('.meteor')[0]

tplPath = 'packages/konsistent/private/templates/mail'

if basePath.indexOf('bundle/programs/server') > 0
	tplPath = '../../programs/server/assets/' + tplPath

emailTemplateOptions =
	root: path.join basePath, tplPath

namespace = undefined

transporters = {}

@mailConsumer = {}

mailConsumer.sendEmail = (record, cb) ->
	server = transporters.default
	if record.server?
		if transporters[record.server]?
			server = transporters[record.server]
		else if record.server is 'googleApp'
			if record._user?.length > 0 and namespace?.googleApp?.clientId? and namespace?.googleApp?.secret?
				user = Konsistent.Models['User'].findOne record._user[0]._id, { fields: { name: 1, emails: 1, 'services.google': 1 }}

				console.log 'IF -> user?.services?.google?.idToken ->',user?.services?.google?.idToken
				if user?.services?.google?.idToken?
					record.from = user.name + ' <' + user.emails[0]?.address + '>'

					try
						if user.services.google.expiresAt < new Date()
							user.services.google = refreshUserToken user._id, namespace.googleApp

							console.log 'new google data ->',user.services.google
					catch e
						NotifyErrors.notify 'MailError', (new Error("Couldn't refresh Google Token")), {record: record}
						Konsistent.Models['Message'].update {_id: record._id}, {$set: {status: 'Falha no Envio', error: e}}
						console.log '📧 ', "Email error: #{JSON.stringify e, null, ' '}".red
						return cb()

					if user?.services?.google?.idToken?
						console.log 'GENERATOR -> user?.services?.google?.idToken ->',user?.services?.google
						generator = xoauth2.createXOAuth2Generator
							user: user.emails[0].address
							clientId: namespace.googleApp.clientId
							clientSecret: namespace.googleApp.secret
							refreshToken: user.services.google.idToken
							accessToken: user.services.google.accessToken

						server = nodemailer.createTransport
							service: 'gmail'
							auth:
								xoauth2: generator
							debug: true
		else
			NotifyErrors.notify 'MailError', (new Error("Server #{record.server} not found")), {record: record}
	else
		record.server = 'default'

	if _.isObject(namespace?.emailServers) and namespace.emailServers[record.server]?.useUserCredentials is true
		user = Konsistent.Models['User'].findOne record._user[0]._id, { fields: { name: 1, emails: 1, emailAuthLogin: 1, emailAuthPass: 1 }}
		console.log 'IF -> user?.emailAuthLogin ->', user?.emailAuthLogin
		if user?.emailAuthLogin
			record.from = user.name + ' <' + user.emails[0]?.address + '>'
			server = nodemailer.createTransport _.extend({}, _.omit(namespace.emailServers[record.server], 'useUserCredentials'), { auth: { user: user.emailAuthLogin, pass: user.emailAuthPass } })

	if (not record.to? or _.isEmpty record.to) and record.email?
		record.to = (email.address for email in [].concat(record.email)).join(',')

	if (not record.from? or _.isEmpty(record.from)) and record._user?.length > 0
		user = Konsistent.Models['User'].findOne record._user[0]._id, { fields: { name: 1, emails: 1 }}

		record.from = user.name + ' <' + user.emails[0]?.address + '>'

	if !record.to
		err = { message: 'No address to send e-mail to.' }
		err.host = serverHost || record.server
		NotifyErrors.notify 'MailError', err, {err: err}
		Konsistent.Models['Message'].update {_id: record._id}, {$set: {status: 'Falha no Envio', error: err}}
		console.log '📧 ', "Email error: #{JSON.stringify err, null, ' '}".red
		return cb()
	else
		mail =
			from: record.from
			to: record.to
			subject: record.subject
			html: record.body
			replyTo: record.replyTo
			cc: record.cc
			bcc: record.bcc
			attachments: record.attachments
			headers: record.headers or []

		if record.meta
			for name, content of record.meta
				mail.html += "<meta name='#{name}' content='#{content}'>"

		if process.env.KONECTY_MODE isnt 'production'
			mail.subject = "[DEV] [#{mail.to}] #{mail.subject}"
			mail.to = null # 'team@konecty.com'
			mail.cc = null
			mail.bcc = null

		if mail.to
			serverHost = server?.transporter?.options?.host
			server.sendMail mail, Meteor.bindEnvironment (err, response) ->
				if err?
					err.host = serverHost || record.server
					NotifyErrors.notify 'MailError', err, {mail: mail, err: err}
					Konsistent.Models['Message'].update {_id: record._id}, {$set: {status: 'Falha no Envio', error: err}}
					console.log '📧 ', "Email error: #{JSON.stringify err, null, ' '}".red
					return cb()

				if response?.accepted.length > 0
					if record.discard is true
						Konsistent.Models['Message'].remove _id: record._id
					else
						Konsistent.Models['Message'].update { _id: record._id }, { $set: { status: record.sentStatus or 'Enviada' } }
					console.log '📧 ', "Email sent to #{response.accepted.join(', ')} via [#{serverHost || record.server}]".green
				cb()
		else
			return cb()

mailConsumer.send = (record, cb) ->
	if not record.template?
		return mailConsumer.sendEmail record, cb

	if Templates[record.template]?
		record.subject ?= Templates[record.template].subject
		record.body = SSR.render record.template, _.extend({ message: { _id: record._id } }, record.data)
		Konsistent.Models['Message'].update { _id: record._id }, { $set: { body: record.body, subject: record.subject } }
		return mailConsumer.sendEmail record, cb

	emailTemplates emailTemplateOptions, Meteor.bindEnvironment (err, render) ->
		if err?
			NotifyErrors.notify 'MailError', err
			Konsistent.Models['Message'].update {_id: record._id}, {$set: {status: 'Falha no Envio', error: err}}
			return cb()

		record.data ?= {}

		render record.template, record.data, Meteor.bindEnvironment (err, html, text) ->
			if err?
				NotifyErrors.notify 'MailError', err, {record: record}
				Konsistent.Models['Message'].update {_id: record._id}, {$set: {status: 'Falha no Envio', error: err}}
				return cb()

			record.body = html

			mailConsumer.sendEmail record, cb

mailConsumer.consume = ->
	return unless Konsistent.Models['Message']?

	mailConsumer.lockedAt = Date.now()
	query =
		type: 'Email'
		status: { $in: [ 'Enviando', 'Send' ] }
		$or: [
			{ sendAt: { $exists: 0 } },
			{ sendAt: { $lt: new Date } }
		]
	options =
		limit: 10

	records = Konsistent.Models['Message'].find(query, options).fetch()
	if records.length is 0
		setTimeout Meteor.bindEnvironment(mailConsumer.consume), 1000
		return

	async.each records, mailConsumer.send, ->
		mailConsumer.consume()

mailConsumer.start = ->
	namespace = Konsistent.MetaObject.findOne _id: 'Namespace'

	if _.isObject namespace?.emailServers
		for key, value of namespace.emailServers
			unless value.useUserCredentials
				console.log "Setup email server [#{key}]".green
				transporters[key] = nodemailer.createTransport smtpTransport value

	if not transporters.default? and process.env.DEFAULT_SMTP_HOST? and process.env.DEFAULT_SMTP_PORT? and process.env.DEFAULT_SMTP_USERNAME? and process.env.DEFAULT_SMTP_PASSWORD?
		defaultSMTPConfig =
			host: process.env.DEFAULT_SMTP_HOST
			port: +process.env.DEFAULT_SMTP_PORT
			auth:
				user: process.env.DEFAULT_SMTP_USERNAME
				pass: process.env.DEFAULT_SMTP_PASSWORD

		if process.env.DEFAULT_SMTP_SECURE?
			defaultSMTPConfig.secure = process.env.DEFAULT_SMTP_SECURE == 'true'

		if process.env.DEFAULT_SMTP_TLS?
			defaultSMTPConfig.tls = process.env.DEFAULT_SMTP_TLS

		if process.env.DEFAULT_SMTP_IGNORE_TLS?
			defaultSMTPConfig.ignoreTLS = process.env.DEFAULT_SMTP_IGNORE_TLS == 'true'
		
		if process.env.DEFAULT_SMTP_TLS_REJECT_UNAUTHORIZED?
			defaultSMTPConfig.tls =
				rejectUnauthorized: process.env.DEFAULT_SMTP_TLS_REJECT_UNAUTHORIZED == 'true'

		if process.env.DEFAULT_SMTP_AUTH_METHOD?
			defaultSMTPConfig.authMethod = process.env.DEFAULT_SMTP_AUTH_METHOD
		
		if process.env.DEFAULT_SMTP_DEBUG?
			defaultSMTPConfig.debug = process.env.DEFAULT_SMTP_DEBUG == 'true'
		
		console.log "Setup default email server -> [#{JSON.stringify defaultSMTPConfig}]".green
		transporters.default = nodemailer.createTransport smtpTransport defaultSMTPConfig

	mailConsumer.consume()
	setInterval ->
		if Date.now() - mailConsumer.lockedAt > 10 * 60 * 1000 # 10 minutes
			mailConsumer.consume()
	, 120000
