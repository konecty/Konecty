import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { pathToRegexp } from 'path-to-regexp';

import path from 'path';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';
import { sendFile } from './sendFile';

import { DEFAULT_THUMBNAIL_SIZE } from '@imports/consts';
import { filePathWithoutExtension } from '@imports/utils/strUtils';

const LEGACY_URL_PATTERN = ':type/:width/:height/:namespace?/:preprocess?/:document/:recordId/:fieldName/:fileName';
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

	if (getFullRegex.test(incomingPath)) {
		logger.trace(`GET_FULL_PATTERN ${incomingPath}`);
		const [, document, recordId, fieldName, fileName] = getFullRegex.exec(incomingPath) ?? [];

		const destination = path.join(document, recordId, fieldName, fileName);
		return sendFile(reply, req.url, destination);
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

			const destination = path.join(...([document, recordId, fieldName, dirEnum[style], fileName].filter(Boolean) as string[]));
			return sendFile(reply, req.url, destination);
		}
	}

	if (legacyUrlRegex.test(incomingPath)) {
		logger.trace(`LEGACY_URL_PATTERN ${incomingPath}`);

		const [, , width, height, , preprocess, document, recordId, fieldName, fileName] = legacyUrlRegex.exec(incomingPath) ?? [];
		const thumbnailSize = MetaObject.Namespace.storage?.thumbnail?.size ?? DEFAULT_THUMBNAIL_SIZE;

		const getImagePath = () => {
			const maxDimension = Math.max(parseInt(width, 10), parseInt(height, 10));
			if (maxDimension <= thumbnailSize) {
				return path.join(document, recordId, fieldName, 'thumbnail', /\.jpe?g$/.test(fileName) ? fileName : `${filePathWithoutExtension(fileName)}.jpeg`);
			}
			if (preprocess != null) {
				return path.join(document, recordId, fieldName, 'watermark', /\.jpe?g$/.test(fileName) ? fileName : `${filePathWithoutExtension(fileName)}.jpeg`);
			}
			return path.join(document, recordId, fieldName, fileName);
		};

		const destination = getImagePath();
		return sendFile(reply, req.url, destination);
	}

	if (legacyFullFileUrlRegex.test(incomingPath)) {
		logger.trace(`LEGACY_FULL_FILE_URL_PATTERN ${incomingPath}`);
		const imagePath = incomingPath
			.replace(new RegExp(`/?${MetaObject.Namespace.ns}`), '')
			.replace(/\/rest/, '')
			.replace(/\/image/, '');

		const res = legacyFullFileUrlRegex.exec(imagePath) ?? [];
		const [, maybeDocument, preprocess, document, recordId, fieldName, fileName] = res;

		const destination =
			preprocess != null ? path.join(document, recordId, fieldName, 'watermark', fileName) : path.join(maybeDocument ?? '', document, recordId, fieldName, fileName);

		return sendFile(reply, req.url, destination);
	}

	return reply.status(404).send('Not found');
}

export default fp(imageApi);
