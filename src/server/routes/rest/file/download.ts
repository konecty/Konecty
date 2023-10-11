import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import axios from 'axios';
import { join } from 'path';
import send from 'send';

import { urlencode_u300 } from './urlencode_u300';

import { logger } from '@imports/utils/logger';

const expiration = 31536000;
const corsFileTypes = ['png', 'jpg', 'gif', 'jpeg', 'webp'];

const fileDownloadApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get('/rest/file/:mode(preview|download)?/:namespace/:metaDocumentId/:recordId/:fieldName/:fileName', fileDownloadFn);
	fastify.get('/file/:mode(preview|download)?/:namespace/:metaDocumentId/:recordId/:fieldName/:fileName', fileDownloadFn);
	fastify.get('/rest/image/:mode(preview|download)?/:namespace/:metaDocumentId/:recordId/:fieldName/:fileName', fileDownloadFn);
	fastify.get('/image/:mode(preview|download)?/:namespace/:metaDocumentId/:recordId/:fieldName/:fileName', fileDownloadFn);

	done();
};

async function fileDownloadFn(
	req: FastifyRequest<{
		Params: {
			mode: string;
			namespace: string;
			metaDocumentId: string;
			recordId: string;
			fieldName: string;
			fileName: string;
		};
	}>,
	reply: FastifyReply,
) {
	try {
		const { mode, namespace, metaDocumentId, recordId, fieldName, fileName } = req.params;

		if (/^s3$/i.test(process.env.STORAGE ?? 'fs')) {
			const origin = `${/https?:\/\//.test(process.env.S3_PUBLIC_URL ?? '') ? process.env.S3_PUBLIC_URL : `https://${process.env.S3_PUBLIC_URL}`}`.replace(/\/$/, '');

			const fileUrl = new URL(`${origin}/konecty.${namespace}/${metaDocumentId}/${recordId}/${fieldName}/${urlencode_u300(fileName)}`);

			const { status, data, headers } = await axios({ method: 'GET', url: fileUrl.toString(), responseType: 'stream' });

			if (corsFileTypes.includes(fileUrl.pathname.split('.').pop() ?? '')) {
				reply.header('Access-Control-Allow-Origin', '*');
			}

			if (status === 200) {
				reply.header('Cache-Control', 'public, max-age=' + expiration);
			} else {
				reply.header('Cache-Control', 'public, max-age=300');
			}

			const ETag = headers['x-bz-content-sha1'] || headers['x-bz-info-src_last_modified_millis'] || headers['x-bz-file-id'];
			if (ETag) {
				reply.header('ETag', ETag);
			}
			if (mode === 'download') {
				reply.header('Content-Disposition', `attachment; filename=${fileName}`);
			}

			reply.header('Content-Type', headers['content-type']);

			data.pipe(reply);
		} else {
			const originPath = join(process.env.STORAGE_DIR ?? '/tmp', metaDocumentId, recordId, fieldName, fileName);
			return send(req.raw, originPath).pipe(reply.raw);
		}
	} catch (error) {
		const { message } = error as Error;
		if (/unathorized/i.test(message) || /status code 401/i.test(message)) {
			return reply.status(401).send('Unathorized');
		} else if (/bad request/i.test(message)) {
			return reply.status(400).send(error);
		} else if (/status code 404/i.test(message)) {
			return reply.status(404).send(error);
		} else {
			logger.error(message, `Error on download file: ${message}`);
			return reply.status(500).send(error);
		}
	}
}

export default fp(fileDownloadApi);
