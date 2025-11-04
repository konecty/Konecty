import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import Handlebars from 'handlebars';

import { execSync } from 'child_process';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

import get from 'lodash/get';
import isDate from 'lodash/isDate';

import getServer from '@imports/utils/getServer';

import { getUser } from '@imports/auth/getUser';
import { logout } from '@imports/auth/logout';
import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
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

// Configuration priority: Namespace → env vars → defaults
function getLoginPageVariant(): string {
	const namespaceValue = MetaObject.Namespace.loginPageVariant;
	if (namespaceValue != null && namespaceValue !== '') {
		return namespaceValue;
	}
	const envValue = process.env.LOGIN_PAGE_VARIANT;
	if (envValue != null && envValue !== '') {
		return envValue;
	}
	return 'classic'; // default
}

function getEmailEnabled(): boolean {
	const namespaceValue = MetaObject.Namespace.otpConfig?.emailTemplateId;
	if (namespaceValue != null && namespaceValue !== '') {
		return true;
	}
	const envValue = process.env.OTP_EMAIL_ENABLED;
	if (envValue === 'true') {
		return true;
	}
	return false;
}

function getWhatsappEnabled(): boolean {
	const namespaceValue = MetaObject.Namespace.otpConfig?.whatsapp;
	if (namespaceValue != null) {
		return true;
	}
	const envValue = process.env.OTP_WHATSAPP_ENABLED;
	if (envValue === 'true') {
		return true;
	}
	return false;
}

function getLocale(): string {
	const namespaceValue = MetaObject.Namespace.locale;
	if (namespaceValue != null && namespaceValue !== '') {
		return namespaceValue;
	}
	const envValue = process.env.DEFAULT_LOCALE;
	if (envValue != null && envValue !== '') {
		return envValue;
	}
	return 'pt_BR'; // default
}

// Translations
const translations = {
	'pt-BR': {
		title_login_page: 'Entre na sua conta do Konecty',
		lbl_login: 'Usuário',
		lbl_password: 'Senha',
		lbl_email: 'Email',
		lbl_phone: 'Telefone',
		lbl_otp_code: 'Código de verificação',
		btn_forget: 'Esqueceu a senha?',
		btn_login: 'Entrar',
		btn_reset: 'Redefinir senha',
		btn_cancel_back: 'Cancelar e retornar ao login',
		btn_receive_code: 'Receba seu código',
		btn_verify_code: 'Verificar código',
		help_reset: 'Você irá receber um email com instruções para redefinir sua senha.',
		lbl_password_sent: 'Sua senha foi enviada para o seu email.',
		lbl_browser_incompatible: 'Seu navegador não é compatível com o sistema.',
		lbl_browser_install: 'Para acessar o sistema você deve instalar um dos navegadores abaixo.',
		lbl_loading: 'Carregando...',
		lbl_receive_code_email: 'Receba seu código por email',
		lbl_quick_login: 'Login rápido',
		lbl_otp_sent_email: 'Enviamos um código de verificação para o seu email.',
		lbl_otp_sent_whatsapp: 'Enviamos um código de verificação para o seu WhatsApp.',
		lbl_or_login_with: 'Ou faça login com',
		help_otp_email: 'Enviaremos um código de verificação para o seu email',
		help_otp_whatsapp: 'Enviaremos um código de verificação via WhatsApp',
	},
	en: {
		title_login_page: 'Sign in to your Konecty account',
		lbl_login: 'User',
		lbl_password: 'Password',
		lbl_email: 'Email',
		lbl_phone: 'Phone',
		lbl_otp_code: 'Verification code',
		btn_forget: 'Forgot your password?',
		btn_login: 'Sign in',
		btn_reset: 'Reset password',
		btn_cancel_back: 'Cancel and back to login',
		btn_receive_code: 'Receive your code',
		btn_verify_code: 'Verify code',
		help_reset: 'You will receive an email with instructions to reset your password.',
		lbl_password_sent: 'Your password has been sent to your email.',
		lbl_browser_incompatible: 'Your browser is not compatible with this system.',
		lbl_browser_install: 'To access this system you may install one of the browsers listed below.',
		lbl_loading: 'Loading...',
		lbl_receive_code_email: 'Receive your code by email',
		lbl_quick_login: 'Quick login',
		lbl_otp_sent_email: 'We sent a verification code to your email.',
		lbl_otp_sent_whatsapp: 'We sent a verification code to your WhatsApp.',
		lbl_or_login_with: 'Or sign in with',
		help_otp_email: 'We will send a verification code to your email',
		help_otp_whatsapp: 'We will send a verification code via WhatsApp',
	},
};

function getTranslations(locale: string): (typeof translations)['pt-BR'] {
	// Normalize locale: handle both pt-BR and pt_BR as Portuguese
	const normalizedLocale = locale.replace('_', '-').toLowerCase();
	if (normalizedLocale === 'en' || normalizedLocale.startsWith('en-')) {
		return translations.en;
	}
	// Default to pt-BR for any other locale (including pt-BR, pt_BR, pt, etc.)
	return translations['pt-BR'];
}

export const viewPaths: FastifyPluginCallback = async fastify => {
	fastify.get('/login', async function (_, reply) {
		const loginPageVariant = getLoginPageVariant();
		const locale = getLocale();
		const translations = getTranslations(locale);
		const emailEnabled = getEmailEnabled();
		const whatsappEnabled = getWhatsappEnabled();

		// Determine which template to use
		const templateName = loginPageVariant === 'modern' ? 'login/modern.hbs' : 'login/login.hbs';
		const loginTemplate = path.join(templatePath(), templateName);

		let loginTemplateContent = await fsPromises.readFile(loginTemplate, 'utf8');

		// For modern template, inject CSS if it exists
		if (loginPageVariant === 'modern') {
			const cssPath = path.join(templatePath(), 'login/modern-tailwind-output.css');
			let cssContent = '';
			try {
				cssContent = await fsPromises.readFile(cssPath, 'utf8');
				logger.debug({ cssPath, cssLength: cssContent.length }, 'Loaded modern login CSS');
			} catch (error) {
				// CSS file not found - try to generate it once in development
				if (process.env.KONECTY_MODE === 'development' || process.env.NODE_ENV !== 'production') {
					try {
						const inputPath = path.join(templatePath(), 'login/modern-tailwind-input.css');
						const outputPath = cssPath;
						// Check if input file exists
						try {
							await fsPromises.access(inputPath);
							// Generate CSS once - use tailwindcss from node_modules/.bin
							const tailwindCmd = path.join(process.cwd(), 'node_modules', '.bin', 'tailwindcss');
							const resolvedInputPath = path.resolve(inputPath);
							const resolvedOutputPath = path.resolve(outputPath);
							// Check if tailwindcss binary exists
							try {
								await fsPromises.access(tailwindCmd);
								execSync(`"${tailwindCmd}" -i "${resolvedInputPath}" -o "${resolvedOutputPath}"`, {
									stdio: 'pipe',
									cwd: process.cwd(),
									env: { ...process.env, PATH: process.env.PATH },
								});
							} catch (binError) {
								// Binary not found, try using yarn
								execSync(`yarn tailwindcss -i "${resolvedInputPath}" -o "${resolvedOutputPath}"`, {
									stdio: 'pipe',
									cwd: process.cwd(),
									env: { ...process.env, PATH: process.env.PATH },
								});
							}
							// Try to read the generated file
							cssContent = await fsPromises.readFile(cssPath, 'utf8');
							logger.info('Generated modern login CSS file automatically');
						} catch (genError) {
							logger.warn({ error: genError, inputPath, outputPath }, 'Could not generate modern login CSS, using empty CSS');
						}
					} catch (autoGenError) {
						logger.warn('Modern login CSS file not found and could not be auto-generated, using empty CSS');
					}
				} else {
					logger.warn('Modern login CSS file not found in production, using empty CSS');
				}
			}
			// Replace placeholder with actual CSS content
			// The placeholder is in the template as {{cssContent}}, but we need to replace it before Handlebars compiles
			const placeholderPattern = '{{cssContent}}';
			const hasPlaceholder = loginTemplateContent.includes(placeholderPattern);
			if (hasPlaceholder) {
				if (cssContent) {
					loginTemplateContent = loginTemplateContent.replace(/\{\{cssContent\}\}/g, cssContent);
					logger.debug({ cssLength: cssContent.length }, 'Injected CSS into modern login template');
				} else {
					loginTemplateContent = loginTemplateContent.replace(/\{\{cssContent\}\}/g, '');
					logger.warn('CSS content is empty, template will have no styles');
				}
			} else {
				logger.warn('Template placeholder {{cssContent}} not found in template');
			}
		}

		// Register Handlebars helpers
		Handlebars.registerHelper('or', function (a, b) {
			return a || b;
		});

		const template = Handlebars.compile(loginTemplateContent);

		const templateData: Record<string, unknown> = {
			env: getEnv(),
			host: getServer(process.env.KONECTY_HOST) || 'my.konecty.com',
			namespace: process.env.KONMETA_NAMESPACE,
			locale: locale,
			uiServer: getServer(process.env.UI_URL) || 'ui.konecty.com',
			collectFingerprint: MetaObject.Namespace.trackUserFingerprint,
			...translations,
		};

		// Only add OTP-related fields for modern template
		if (loginPageVariant === 'modern') {
			templateData.emailEnabled = emailEnabled;
			templateData.whatsappEnabled = whatsappEnabled;
			// Get default country based on locale
			const normalizedLocale = locale.replace('_', '-').toLowerCase();
			templateData.defaultCountry = normalizedLocale === 'en' || normalizedLocale.startsWith('en-') ? 'US' : 'BR';
		}

		const result = template(templateData);

		reply.header('Content-Type', 'text/html');

		return reply.send(result);
	});

	fastify.get('/login.js', function (_, reply) {
		const loginJsFilePath = path.join(templatePath(), 'login/login.js');
		const fileStream = fs.createReadStream(loginJsFilePath);
		reply.header('Content-Type', 'application/javascript');
		reply.send(fileStream);
	});

	fastify.get('/login-modern.js', function (_, reply) {
		const loginModernJsFilePath = path.join(templatePath(), 'login/modern.js');
		const fileStream = fs.createReadStream(loginModernJsFilePath);
		reply.header('Content-Type', 'application/javascript');
		reply.send(fileStream);
	});

	fastify.get('/login-country-codes.js', function (_, reply) {
		const countryCodesJsFilePath = path.join(templatePath(), 'login/country-codes.js');
		const fileStream = fs.createReadStream(countryCodesJsFilePath);
		reply.header('Content-Type', 'application/javascript');
		reply.send(fileStream);
	});

	fastify.get('/fp.js', function (_, reply) {
		const fpJsFilePath = path.join(templatePath(), 'fingerprint.js');
		const fileStream = fs.createReadStream(fpJsFilePath);
		reply.header('Content-Type', 'application/javascript');
		reply.send(fileStream);
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
				collectFingerprint: MetaObject.Namespace.trackUserFingerprint,
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
};

export default fp(viewPaths);
