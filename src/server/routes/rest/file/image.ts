import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { pathToRegexp } from 'path-to-regexp';

import path from 'path';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import { sendFile } from './sendFile';

import { DEFAULT_THUMBNAIL_SIZE } from '@imports/consts';

const LEGACY_URL_PATTERN = ':type/:width/:height/:namespace/:preprocess?/:document/:recordId/:fieldName/:fileName';
const LEGACY_FULL_FILE_URL_PATTERN = ':namespace/:preprocess?/:document/:recordId/:fieldName/:fileName';
const GET_FULL_PATTERN = ':document/:recordId/:fieldName/:fileName';
const GET_STYLE_PATTERN = ':style/:document/:recordId/:fieldName/:fileName';

const legacyUrlRegex = pathToRegexp(LEGACY_URL_PATTERN);
const legacyFullFileUrlRegex = pathToRegexp(LEGACY_FULL_FILE_URL_PATTERN);
const getFullRegex = pathToRegexp(GET_FULL_PATTERN);
const getStyleRegex = pathToRegexp(GET_STYLE_PATTERN);

const imageApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get('/rest/image/*', imageApiFn);
	fastify.get('/image/*', imageApiFn);
	done();
};

async function imageApiFn(
	req: FastifyRequest<{
		Params: { '*': string };
	}>,
	reply: FastifyReply,
) {
	const incomingPath = req.params['*'];
	const namespace = MetaObject.Namespace.name;

	if (getFullRegex.test(incomingPath)) {
		logger.trace(`GET_FULL_PATTERN ${incomingPath}`);
		const [, document, recordId, fieldName, fileName] = getFullRegex.exec(incomingPath) ?? [];

		const destination = path.join(namespace, document, recordId, fieldName, fileName);
		return sendFile(destination, reply);
	}

	if (getStyleRegex.test(incomingPath)) {
		logger.trace(`GET_STYLE_PATTERN ${incomingPath}`);
		const [, style, document, recordId, fieldName, fileName] = getStyleRegex.exec(incomingPath) ?? [];

		if (['full', 'thumb', 'wm'].includes(style)) {
			const dirEnum: Record<string, string | null> = {
				full: null,
				thumb: 'thumbnail',
				wm: 'watermark',
			};

			const destination = path.join(...[namespace, document, recordId, fieldName, dirEnum[style], fileName].filter(Boolean));
			return sendFile(destination, reply);
		}
	}

	if (legacyUrlRegex.test(incomingPath)) {
		logger.trace(`LEGACY_URL_PATTERN ${incomingPath}`);

		const [, , width, height, , preprocess, document, recordId, fieldName, fileName] = legacyUrlRegex.exec(incomingPath) ?? [];

		const thumbnailSize = MetaObject.Namespace.storage?.thumbnail?.size ?? DEFAULT_THUMBNAIL_SIZE;

		const getImagePath = () => {
			const maxDimension = Math.max(parseInt(width, 10), parseInt(height, 10));
			if (maxDimension <= thumbnailSize) {
				return path.join(namespace, document, recordId, fieldName, 'thumbnail', fileName);
			}
			if (preprocess != null) {
				return path.join(namespace, document, recordId, fieldName, 'watermark', fileName);
			}
			return path.join(namespace, document, recordId, fieldName, fileName);
		};

		const destination = getImagePath();
		return sendFile(destination, reply);
	}

	if (legacyFullFileUrlRegex.test(incomingPath)) {
		logger.trace(`LEGACY_FULL_FILE_URL_PATTERN ${incomingPath}`);
		const [, , preprocess, document, recordId, fieldName, fileName] = legacyFullFileUrlRegex.exec(incomingPath) ?? [];

		const destination =
			preprocess != null ? path.join(namespace, document, recordId, fieldName, 'watermark', fileName) : path.join(namespace, document, recordId, fieldName, fileName);

		return sendFile(destination, reply);
	}

	return reply.status(404).send('Not found');
}

export default fp(imageApi);
