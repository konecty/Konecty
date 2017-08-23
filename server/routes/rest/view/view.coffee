app.get '/login', (req, res, next) ->
	if process.env.INTERFACE is 'METEOR' or req.headers.interface is 'METEOR'
		return next()

	res.render 'login.html',
		env: if process.env.KONECTY_MODE is 'development' then 'dev-' else ''
		host: process.env.KONECTY_HOST or 'my.konecty.com'
		title_login_page: 'Entre na sua conta do Konecty'
		lbl_login: 'Usuário'
		lbl_password: 'Senha'
		lbl_company: 'Nome da Empresa'
		btn_forget: 'Esqueceu a senha?'
		btn_login: 'Entrar'
		btn_reset: 'Redefinir senha'
		help_reset: 'Você irá receber um email com instruções para redefinir sua senha.'
		btn_cancel_back: 'Cancelar e retornar ao login'
		lbl_password_sent: 'Sua senha foi enviada para o seu email.'
		lbl_browser_incompatible: 'Seu navegador não é compatível com o sistema.'
		lbl_browser_install: 'Para acessar o sistema você deve instalar um dos navegadores abaixo.'

app.get '/login.js', (req, res, next) ->
	if process.env.INTERFACE is 'METEOR' or req.headers.interface is 'METEOR'
		return next()

	path = require 'path'
	basePath = path.resolve('.').split('.meteor')[0]
	tplPath = 'assets/app/'
	if basePath.indexOf('bundle/programs/server') > 0
		tplPath = '../../programs/server/assets/app/'

	fs = require 'fs'
	login = fs.readFileSync tplPath + 'login/login.js'

	res.writeHead 200, 'Content-Type': 'application/javascript'
	res.end login

app.get '/', (req, res, next) ->
	if process.env.INTERFACE is 'METEOR' or req.headers.interface is 'METEOR' or req.query.mocha?
		return next()

	user = Meteor.call 'auth:getUser',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		dontSetLastLogin: true

	if user is 401
		return res.redirect '/login'

	time = 21600000 # 6h

	if not user.lastLogin? or not _.isDate(user.lastLogin) or (Date.now() - user.lastLogin.getTime()) > time
		Meteor.call 'auth:logout', authTokenId: sessionUtils.getAuthTokenIdFromReq req
		return res.redirect '/login'

	config =
		env: if process.env.KONECTY_MODE is 'development' then 'dev-' else ''
		host: process.env.KONECTY_HOST or 'my.konecty.com'
		locale: user.locale
		lbl_loading: 'Carregando o sistema...'
		btn_close: 'Fechar'
		timeInMilis: + new Date

	if process.env.BLOB_URL?
		config.blobUrl = process.env.BLOB_URL

	if process.env.PREVIEW_URL? or process.env.BLOB_URL?
		config.previewUrl = process.env.PREVIEW_URL or process.env.BLOB_URL

	res.render 'index.html', config
