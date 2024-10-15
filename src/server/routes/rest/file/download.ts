import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import path from 'path';
import { pathToRegexp } from 'path-to-regexp';

import { logger } from '@imports/utils/logger';

import { sendFile } from './sendFile';

const LEGACY_DOWNLOAD_URL_PATTERN = ':mode(preview|download)?/:namespace/:document/:code/:fieldName/:fileName';
const DOWNLOAD_URL_PATTERN = ':document/:code/:fieldName/:fileName';

const legacyDownloadUrlRegex = pathToRegexp(LEGACY_DOWNLOAD_URL_PATTERN);
const downloadUrlRegex = pathToRegexp(DOWNLOAD_URL_PATTERN);

const fileDownloadApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get('/rest/file/*', fileDownloadFn);
	fastify.get('/file/*', fileDownloadFn);

	done();
};

async function fileDownloadFn(
	req: FastifyRequest<{
		Params: {
			'*': string;
		};
	}>,
	reply: FastifyReply,
) {
	const incomingPath = req.params['*'];

	if (downloadUrlRegex.test(incomingPath)) {
		logger.trace(`DOWNLOAD_URL_PATTERN ${incomingPath}`);
		const [, document, code, fieldName, fileName] = downloadUrlRegex.exec(incomingPath) ?? [];

		const destination = path.join(document, code, fieldName, fileName);
		return sendFile(reply, incomingPath, destination);
	}

	if (legacyDownloadUrlRegex.test(incomingPath)) {
		logger.trace(`LEGACY_DOWNLOAD_URL_PATTERN ${incomingPath}`);
		const [, , , document, code, fieldName, fileName] = legacyDownloadUrlRegex.exec(incomingPath) ?? [];

		const destination = path.join(document, code, fieldName, fileName);
		return sendFile(reply, incomingPath, destination);
	}

	logger.trace(`File not found ${incomingPath}`);

	return reply.status(404).send();
}

export default fp(fileDownloadApi);
