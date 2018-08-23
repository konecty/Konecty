/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
app.get('/login', function(req, res, next) {
	if ((process.env.INTERFACE === 'METEOR') || (req.headers.interface === 'METEOR')) {
		return next();
	}

	return res.render('login.html', {
		env: process.env.KONECTY_MODE === 'development' ? 'dev-' : '',
		host: process.env.KONECTY_HOST || 'my.konecty.com',
		namespace: process.env.KONMETA_NAMESPACE,
		title_login_page: 'Entre na sua conta do Konecty',
		lbl_login: 'Usuário',
		lbl_password: 'Senha',
		btn_forget: 'Esqueceu a senha?',
		btn_login: 'Entrar',
		btn_reset: 'Redefinir senha',
		help_reset: 'Você irá receber um email com instruções para redefinir sua senha.',
		btn_cancel_back: 'Cancelar e retornar ao login',
		lbl_password_sent: 'Sua senha foi enviada para o seu email.',
		lbl_browser_incompatible: 'Seu navegador não é compatível com o sistema.',
		lbl_browser_install: 'Para acessar o sistema você deve instalar um dos navegadores abaixo.'
	}
	);
});

app.get('/login.js', function(req, res, next) {
	if ((process.env.INTERFACE === 'METEOR') || (req.headers.interface === 'METEOR')) {
		return next();
	}

	const path = require('path');
	const basePath = path.resolve('.').split('.meteor')[0];
	let tplPath = 'assets/app/';
	if (basePath.indexOf('bundle/programs/server') > 0) {
		tplPath = '../../programs/server/assets/app/';
	}

	const fs = require('fs');
	const login = fs.readFileSync(tplPath + 'login/login.js');

	res.writeHead(200, {'Content-Type': 'application/javascript'});
	return res.end(login);
});

app.get('/', function(req, res, next) {
	if ((process.env.INTERFACE === 'METEOR') || (req.headers.interface === 'METEOR') || (req.query.mocha != null)) {
		return next();
	}

	const user = Meteor.call('auth:getUser', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		dontSetLastLogin: true
	}
	);

	if (user === 401) {
		return res.redirect('/login');
	}

	const time = 21600000; // 6h

	if ((user.lastLogin == null) || !_.isDate(user.lastLogin) || ((Date.now() - user.lastLogin.getTime()) > time)) {
		Meteor.call('auth:logout', {authTokenId: sessionUtils.getAuthTokenIdFromReq(req)});
		return res.redirect('/login');
	}

	const config = {
		env: process.env.KONECTY_MODE === 'development' ? 'dev-' : '',
		host: process.env.KONECTY_HOST || 'my.konecty.com',
		locale: user.locale,
		lbl_loading: 'Carregando o sistema...',
		btn_close: 'Fechar',
		timeInMilis: + new Date
	};

	if (process.env.BLOB_URL != null) {
		config.blobUrl = process.env.BLOB_URL;
	}

	if ((process.env.PREVIEW_URL != null) || (process.env.BLOB_URL != null)) {
		config.previewUrl = process.env.PREVIEW_URL || process.env.BLOB_URL;
	}

	return res.render('index.html', config);
});
