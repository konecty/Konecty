import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import Handlebars from 'handlebars';

import path from 'path';
import fsPromises from 'fs/promises';
import fs from 'fs';

import isDate from 'lodash/isDate';
import get from 'lodash/get';

import getServer from '@imports/utils/getServer';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { logout } from '@imports/auth/logout';
import { getUser } from '@imports/auth/getUser';
import { logger } from '@imports/utils/logger';
import { templatePath } from '@imports/utils/templatesPath';

const getEnv = () => {
	if (process.env.KONECTY_MODE === 'development') {
		return 'dev-';
	}
	if (process.env.KONECTY_RIA != null) {
		return `${process.env.KONECTY_RIA}-`;
	}
	return '';
};

export const viewPaths: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get('/login', async function (_, reply) {
		const loginTemplate = path.join(templatePath(), 'login/login.hbs');

		const loginTemplateContent = await fsPromises.readFile(loginTemplate, 'utf8');

		const template = Handlebars.compile(loginTemplateContent);

		const result = template({
			env: getEnv(),
			host: getServer(process.env.KONECTY_HOST) || 'my.konecty.com',
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
			lbl_browser_install: 'Para acessar o sistema você deve instalar um dos navegadores abaixo.',
			uiServer: getServer(process.env.UI_URL) || 'ui.konecty.com',
		});

		reply.header('Content-Type', 'text/html');

		return reply.send(result);
	});

	fastify.get('/login.js', function (_, reply) {
		const loginJsFilePath = path.join(templatePath(), 'login/login.js');
		const fileStream = fs.createReadStream(loginJsFilePath);
		reply.header('Content-Type', 'application/javascript');
		reply.send(fileStream);
		// fileStream.pipe(reply.raw);
	});

	fastify.get('/', async function (req, reply) {
		const authTokenId = getAuthTokenIdFromReq(req);

		try {
			const user = await getUser(authTokenId);
			const time = 21600000; // 6h

			if (!user.lastLogin || !isDate(user.lastLogin) || Date.now() - user.lastLogin.getTime() > time) {
				await logout(getAuthTokenIdFromReq(req));
				return reply.redirect('/login');
			}

			const config = {
				env: getEnv(),
				host: getServer(process.env.KONECTY_HOST) || 'my.konecty.com',
				locale: get(user, 'locale', 'en'),
				lbl_loading: 'Carregando o sistema...',
				btn_close: 'Fechar',
				timeInMilis: +new Date(),
				uiServer: getServer(process.env.UI_URL) || 'ui.konecty.com',
				blobUrl: process.env.BLOB_URL == null ? '' : `//${getServer(process.env.BLOB_URL)}`,
				previewUrl: process.env.PREVIEW_URL == null ? '' : `//${getServer(process.env.PREVIEW_URL)}`,
			};

			const indexTemplatePath = path.join(templatePath(), 'index.hbs');

			const indexTemplate = await fsPromises.readFile(indexTemplatePath, 'utf8');

			const template = Handlebars.compile(indexTemplate);

			const result = template(config);

			return reply.header('Content-Type', 'text/html').send(result);
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.redirect('/login');
			}
			logger.error(error, 'Error on GET /');
		}
	});

	done();
};

export default fp(viewPaths);
