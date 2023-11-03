import type { FastifyCookieOptions } from '@fastify/cookie';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';

import { logger } from '@imports/utils/logger';
import documentApi from './api/document';
import formApi from './api/form';
import listViewApi from './api/list-view';
import mainMenuApi from './api/menu/main';
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
import menuApi from './rest/menu/menu';
import processApi from './rest/process/processApi';
import rocketchatApi from './rest/rocketchat/livechat';
import viewPaths from './rest/view/view';

import healthApi from './rest/health';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

export const fastify = Fastify({
	logger,
});

fastify.register(cookie, {
	secret: process.env.COOKIES_SECRET ?? 'konecty-secret',
	parseOptions: {} as FastifyCookieOptions,
} as FastifyCookieOptions);

fastify.register(documentApi);
fastify.register(formApi);
fastify.register(listViewApi);
fastify.register(mainMenuApi);
fastify.register(translatioApi);
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
fastify.register(viewPaths);
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
