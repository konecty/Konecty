import type { FastifyCookieOptions } from '@fastify/cookie';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';

import cors, { FastifyCorsOptions } from '@fastify/cors';
import proxy from '@fastify/http-proxy';

import initializeInstrumentation from '@imports/telemetry';
import { logger } from '@imports/utils/logger';

import accessApi from '@server/routes/api/access';
import documentApi from './api/document';
import formApi from './api/form';
import listViewApi from './api/list-view';
import mainMenuApi from './api/menu/main';
import metasByDocumentApi from './api/metas-by-document';
import noAuth from './api/no-auth';
import otpApi from './api/auth/otp';
import translatioApi from './api/translation';
import authApi from './rest/auth/authApi';
import changeUserApi from './rest/changeUser/changeUserApi';
import commentApi from './rest/comment/commentApi';
import dataApi from './rest/data/dataApi';
import dneApi from './rest/dne/dne';
import fileDeleteApi from './rest/file/delete';
import fileDownloadApi from './rest/file/download';
import imageApi from './rest/file/image';
import fileUploadApi from './rest/file/upload';
import file2Api from './rest/file2/file2Api';
import healthApi from './rest/health';
import menuApi from './rest/menu/menu';
import processApi from './rest/process/processApi';
import rocketchatApi from './rest/rocketchat/livechat';
import viewPaths from './rest/view/view';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const DISABLE_REQUEST_LOGGING = process.env.LOG_REQUESTS !== 'true';

const fastify = Fastify({
	logger,
	maxParamLength: 250,
	disableRequestLogging: DISABLE_REQUEST_LOGGING,
	connectionTimeout: 120000, // 2 minutes
	requestTimeout: 120000, // 2 minutes
});

fastify.register(initializeInstrumentation(), { ignoreRoutes: ['/liveness', '/readiness'] });

fastify.register(cookie, {
	secret: process.env.COOKIES_SECRET ?? 'konecty-secret',
	parseOptions: {} as FastifyCookieOptions,
} as FastifyCookieOptions);

fastify.register(cors, getCorsConfig());

fastify.register(accessApi);
fastify.register(metasByDocumentApi);
fastify.register(documentApi);
fastify.register(formApi);
fastify.register(listViewApi);
fastify.register(mainMenuApi);
fastify.register(translatioApi);
fastify.register(otpApi);
fastify.register(authApi);
fastify.register(changeUserApi);
fastify.register(commentApi);
fastify.register(dataApi);
fastify.register(dneApi);
fastify.register(fileDeleteApi);
fastify.register(fileDownloadApi);
fastify.register(imageApi);
fastify.register(fileUploadApi);
fastify.register(file2Api);
fastify.register(menuApi);
fastify.register(processApi);
fastify.register(rocketchatApi);
fastify.register(noAuth);
if (process.env.UI_PROXY === 'true') {
	fastify.register(proxy, {
		upstream: process.env.UI_PROXY_URL ?? 'http://localhost:3000',
		httpMethods: ['GET'],
	});
} else {
	fastify.register(viewPaths);
}
if (process.env.UI_PROXY_PATH && process.env.UI_PROXY_URL) {
	fastify.register(proxy, {
		upstream: process.env.UI_PROXY_URL,
		httpMethods: ['GET', 'HEAD'],
		prefix: `${process.env.UI_PROXY_PATH}:path`,
		rewritePrefix: ':path',
		disableRequestLogging: true,
		replyOptions: {
			onResponse: (request, reply) => {
				const proxyUrl = `${process.env.UI_PROXY_URL}${request.url?.replace('/ui', '')}`;
				reply.from(proxyUrl);
			},
		},
	});
}
fastify.register(healthApi);

export async function serverStart() {
	try {
		await fastify.listen({
			port: PORT,
			host: HOST,
		});
	} catch (error) {
		fastify.log.error(error);
		process.exit(1);
	}
}

function getCorsConfig() {
	const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split('|');
	if (process.env.UI_PROXY_URL) {
		ALLOWED_ORIGINS.push(process.env.UI_PROXY_URL);
	}
	const corsOptions: FastifyCorsOptions = {
		origin: function (origin, callback) {
			if (origin) {
				if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
					callback(null, true);
				} else {
					logger.error(`${origin} Not allowed by CORS`);
					callback(new Error(`Not allowed by CORS`), false);
				}
			} else {
				callback(null, true);
			}
		},
		allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
		credentials: true,
		optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
	};

	return corsOptions;
}
