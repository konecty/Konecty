import { isDate } from 'lodash';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const getEnv = () => {
	if (process.env.KONECTY_MODE === 'development') {
		return 'dev-';
	}
	if (process.env.KONECTY_RIA != null) {
		return `${process.env.KONECTY_RIA}-`;
	}
	return '';
};

app.get('/login', function(req, res, next) {
	if (process.env.INTERFACE === 'METEOR' || req.headers.interface === 'METEOR') {
		return next();
	}

	res.render('login.html', {
		env: getEnv(),
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
	});
});

app.get('/login.js', function(req, res, next) {
	if (process.env.INTERFACE === 'METEOR' || req.headers.interface === 'METEOR') {
		return next();
	}

	const basePath = resolve('.').split('.meteor')[0];
	let tplPath = 'assets/app/';
	if (basePath.indexOf('bundle/programs/server') > 0) {
		tplPath = '../../programs/server/assets/app/';
	}

	const login = readFileSync(tplPath + 'login/login.js');

	res.writeHead(200, { 'Content-Type': 'application/javascript' });
	return res.end(login);
});

app.get('/', function(req, res, next) {
	if (process.env.INTERFACE === 'METEOR' || req.headers.interface === 'METEOR' || req.query.mocha != null) {
		return next();
	}
	const user = Meteor.call('auth:getUser', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		dontSetLastLogin: true
	});

	if (user === 401) {
		return res.redirect('/login');
	}

	const time = 21600000; // 6h

	if (!user.lastLogin || !isDate(user.lastLogin) || Date.now() - user.lastLogin.getTime() > time) {
		Meteor.call('auth:logout', { authTokenId: sessionUtils.getAuthTokenIdFromReq(req) });
		return res.redirect('/login');
	}

	const config = {
		env: getEnv(),
		host: process.env.KONECTY_HOST || 'my.konecty.com',
		locale: user.locale,
		lbl_loading: 'Carregando o sistema...',
		btn_close: 'Fechar',
		timeInMilis: +new Date()
	};

	if (process.env.BLOB_URL) {
		config.blobUrl = process.env.BLOB_URL;
	}

	if (process.env.PREVIEW_URL || process.env.BLOB_URL) {
		config.previewUrl = process.env.PREVIEW_URL || process.env.BLOB_URL;
	}

	res.render('index.html', config);
});
