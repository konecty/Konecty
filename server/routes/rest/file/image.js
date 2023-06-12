import axios from 'axios';
import sharp from 'sharp';
import { readFile, createReadStream } from 'fs';
import { promisify } from 'util';
import { join } from 'path';

import { app } from '/server/lib/routes/app';
import { middlewares } from '/server/lib/routes/middlewares';

import fixedEncodeURIComponent from './urlencode_u300';

const _readFile = promisify(readFile);

import detectContentType from './detectContentType';

const expiration = 31536000;
const corsFileTypes = ['png', 'jpg', 'gif', 'jpeg', 'webp'];

app.get('(/rest/|/)image/:type/:width/:height/:namespace/:preprocess?/:document/:recordId/:fieldName/:fileName', async (req, res) => {
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

		let originData, contentType;

		if (/^s3$/i.test(process.env.STORAGE)) {
			const origin = `${/https?:\/\//.test(process.env.S3_PUBLIC_URL) ? process.env.S3_PUBLIC_URL : `https://${process.env.S3_PUBLIC_URL}`}`.replace(/\/$/, '');

			const fileUrl = new URL(`${origin}/konecty.${namespace}/${document}/${recordId}/${fieldName}/${fixedEncodeURIComponent(fileName)}`);

			const { status, data, headers } = await axios({ method: 'GET', url: fileUrl.toString(), responseType: 'stream' });
			originData = data;
			contentType = headers['content-type'];

			if (corsFileTypes.includes(fileUrl.pathname.split('.').pop())) {
				res.setHeader('Access-Control-Allow-Origin', '*');
			}
			if (status === 200) {
				res.setHeader('Cache-Control', 'public, max-age=' + expiration);
			} else {
				res.setHeader('Cache-Control', 'public, max-age=300');
			}
			const ETag = headers['x-bz-content-sha1'] || headers['x-bz-info-src_last_modified_millis'] || headers['x-bz-file-id'];
			if (ETag) {
				res.setHeader('ETag', ETag);
			}
		} else {
			const origin = join(process.env.STORAGE_DIR, document, recordId, fieldName, fileName);
			contentType = await detectContentType(origin);
			originData = createReadStream(origin);

			res.setHeader('Cache-Control', 'public, max-age=' + expiration);
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

			res.setHeader('Content-Type', 'image/jpeg');

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
				.pipe(res);
		}
		res.setHeader('Content-Type', contentType);

		if (preprocess != null) {
			let preprocessBuffer;

			if (/^s3$/i.test(process.env.STORAGE)) {
				const origin = `${/https?:\/\//.test(process.env.S3_PUBLIC_URL) ? process.env.S3_PUBLIC_URL : `https://${process.env.S3_PUBLIC_URL}`}`.replace(/\/$/, '');
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
				preprocessBuffer = await _readFile(join(process.env.STORAGE_DIR, `${preprocess}.png`));
			}

			if (preprocessBuffer != null) {
				if (type === 'inner') {
					const originBuffer = await new Promise((resolve, reject) => {
						const bufs = [];
						const stream = originData.pipe(transformer);
						stream.on('data', buf => bufs.push(buf));
						stream.on('end', () => {
							resolve(Buffer.concat(bufs));
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
					return res.send(output);
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

		originData.pipe(transformer).pipe(res);
	} catch (error) {
		const { message } = error;
		if (/unathorized/i.test(message) || /status code 401/i.test(message)) {
			return res._headerSent ? null : res.send(401, 'Unathorized');
		} else if (/bad request/i.test(message)) {
			return res._headerSent ? null : res.send(400, error);
		} else if (/status code 404/i.test(message)) {
			return res._headerSent ? null : res.send(404, error);
		} else {
			console.error(message);
			return res._headerSent ? null : res.send(500, error);
		}
	}
});
