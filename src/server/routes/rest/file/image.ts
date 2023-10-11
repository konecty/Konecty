import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import axios from 'axios';
import sharp from 'sharp';
import { readFile, createReadStream, ReadStream } from 'fs';
import { promisify } from 'util';
import { join } from 'path';

import { urlencode_u300 } from './urlencode_u300';

const _readFile = promisify(readFile);

import detectContentType from './detectContentType';
import { logger } from '@imports/utils/logger';

const expiration = 31536000;
const corsFileTypes = ['png', 'jpg', 'gif', 'jpeg', 'webp'];

const imageApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get('/rest/image/:type/:width/:height/:namespace/:preprocess/:document/:recordId/:fieldName/:fileName', imageApiFn);
	fastify.get('/image/:type/:width/:height/:namespace/:preprocess/:document/:recordId/:fieldName/:fileName', imageApiFn);

	done();
};

async function imageApiFn(
	req: FastifyRequest<{
		Params: { type: string; width: string; height: string; namespace: string; preprocess: string; document: string; recordId: string; fieldName: string; fileName: string };
	}>,
	reply: FastifyReply,
) {
	try {
		const { type, width: parW, height: parH, namespace, preprocess, document, recordId, fieldName, fileName } = req.params;

		if (!['inner', 'crop', 'outer', 'force'].includes(type)) {
			throw new Error('Bad request: type does not exists');
		}

		const width = parseInt(parW, 10) || undefined;
		const height = parseInt(parH, 10) || undefined;

		let transformer = sharp();

		switch (type) {
			case 'outer':
				transformer = transformer.resize({
					width,
					height,
					fit: sharp.fit.outside,
					position: sharp.gravity.center,
				});
				break;

			case 'crop':
				transformer = transformer
					.resize({
						width,
						height,
						fit: sharp.fit.outside,
						position: sharp.gravity.center,
					})
					.resize({
						width,
						height,
						fit: sharp.fit.cover,
					});
				break;

			case 'inner':
				transformer = transformer.resize({
					width,
					height,
					fit: sharp.fit.inside,
					position: sharp.gravity.center,
				});
				break;

			case 'force':
				transformer = transformer.resize({
					width,
					height,
					fit: sharp.fit.fill,
					position: sharp.gravity.center,
				});
				break;

			default:
		}

		let originData: ReadStream, contentType;

		if (/^s3$/i.test(process.env.STORAGE ?? 'fs')) {
			const origin = `${/https?:\/\//.test(process.env.S3_PUBLIC_URL ?? '') ? process.env.S3_PUBLIC_URL : `https://${process.env.S3_PUBLIC_URL}`}`.replace(/\/$/, '');

			const fileUrl = new URL(`${origin}/konecty.${namespace}/${document}/${recordId}/${fieldName}/${urlencode_u300(fileName)}`);

			const { status, data, headers } = await axios({ method: 'GET', url: fileUrl.toString(), responseType: 'stream' });
			originData = data;
			contentType = headers['content-type'];

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
		} else {
			const origin = join(process.env.STORAGE_DIR ?? '/tmp', document, recordId, fieldName, fileName);
			contentType = await detectContentType(origin);
			originData = createReadStream(origin);

			reply.header('Cache-Control', 'public, max-age=' + expiration);
		}

		if (!/image\/(png|jpg|gif|jpeg|webp)/.test(contentType)) {
			const svg = `
		<svg xmlns="http://www.w3.org/2000/svg">
			<g>
				<rect x="0" y="0" width="2048" height="2048" fill="#cccccc"></rect>
				<path fill="#ffffff" transform="translate(700, 764)"  d="M320 400c-75.85 0-137.25-58.71-142.9-133.11L72.2 185.82c-13.79 17.3-26.48 35.59-36.72 55.59a32.35 32.35 0 0 0 0 29.19C89.71 376.41 197.07 448 320 448c26.91 0 52.87-4 77.89-10.46L346 397.39a144.13 144.13 0 0 1-26 2.61zm313.82 58.1l-110.55-85.44a331.25 331.25 0 0 0 81.25-102.07 32.35 32.35 0 0 0 0-29.19C550.29 135.59 442.93 64 320 64a308.15 308.15 0 0 0-147.32 37.7L45.46 3.37A16 16 0 0 0 23 6.18L3.37 31.45A16 16 0 0 0 6.18 53.9l588.36 454.73a16 16 0 0 0 22.46-2.81l19.64-25.27a16 16 0 0 0-2.82-22.45zm-183.72-142l-39.3-30.38A94.75 94.75 0 0 0 416 256a94.76 94.76 0 0 0-121.31-92.21A47.65 47.65 0 0 1 304 192a46.64 46.64 0 0 1-1.54 10l-73.61-56.89A142.31 142.31 0 0 1 320 112a143.92 143.92 0 0 1 144 144c0 21.63-5.29 41.79-13.9 60.11z"></path>
				<text x="1024" y="1400" text-anchor="middle" alignment-baseline="top" font-family="Verdana" font-size="80" fill="#ffffff">${fileName}</text>
			</g>
		</svg>`;

			reply.header('Content-Type', 'image/jpeg');

			return sharp(Buffer.from(svg))
				.resize({
					width: 2048,
					height: 2048,
					fit: sharp.fit.contain,
					position: sharp.gravity.center,
					background: '#cccccc',
				})
				.jpeg({ force: true })
				.pipe(transformer)
				.pipe(reply.raw);
		}
		reply.header('Content-Type', contentType);

		if (preprocess != null) {
			let preprocessBuffer;

			if (/^s3$/i.test(process.env.STORAGE ?? 'fs')) {
				const origin = `${/https?:\/\//.test(process.env.S3_PUBLIC_URL ?? '') ? process.env.S3_PUBLIC_URL : `https://${process.env.S3_PUBLIC_URL}`}`.replace(/\/$/, '');
				try {
					const { status, data } = await axios({
						method: 'GET',
						url: `${origin}/konecty.${namespace}/${preprocess}.png`,
						responseType: 'arraybuffer',
					});
					if (status === 200) {
						preprocessBuffer = data;
					}
				} catch (_) {
					preprocessBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
				}
			} else {
				preprocessBuffer = await _readFile(join(process.env.STORAGE_DIR ?? '/tmp', `${preprocess}.png`));
			}

			if (preprocessBuffer != null) {
				if (type === 'inner') {
					const originBuffer = await new Promise<Buffer>((resolve, reject) => {
						const buffs: Array<Uint8Array> = [];
						const stream = originData.pipe(transformer);
						stream.on('data', buf => buffs.push(buf));
						stream.on('end', () => {
							resolve(Buffer.concat(buffs));
						});
						stream.on('error', reject);
					});

					const origin = sharp(originBuffer);
					const meta = await origin.metadata();

					const overlay = await sharp(preprocessBuffer)
						.resize({
							width: meta.width,
							height: meta.height,
							fit: sharp.fit.inside,
							position: sharp.gravity.center,
						})
						.toBuffer();
					const output = await origin
						.composite([
							{
								input: overlay,
								gravity: sharp.gravity.center,
							},
						])
						.toBuffer();
					return reply.send(output);
				}

				const overlay = await sharp(preprocessBuffer)
					.resize({
						width,
						height,
						fit: sharp.fit.inside,
						position: sharp.gravity.center,
					})
					.toBuffer();
				transformer = transformer.composite([
					{
						input: overlay,
						gravity: sharp.gravity.center,
					},
				]);
			}
		}

		originData.pipe(transformer).pipe(reply.raw);
	} catch (error) {
		const { message } = error as Error;
		if (/unathorized/i.test(message) || /status code 401/i.test(message)) {
			return reply.status(401).send('Unathorized');
		} else if (/bad request/i.test(message)) {
			return reply.status(400).send(error);
		} else if (/status code 404/i.test(message)) {
			return reply.status(404).send(error);
		} else {
			logger.error(error, `Error on ${req.url}: ${message}`);
			return reply.status(500).send(error);
		}
	}
}

export default fp(imageApi);
