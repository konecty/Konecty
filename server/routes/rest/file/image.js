import axios from 'axios';
import sharp from 'sharp';
import { readFile, createReadStream } from 'fs';
import { promisify } from 'util';
import { join } from 'path';

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

		let originData;

		if (/^s3$/i.test(process.env.STORAGE)) {
			const origin = `${/https?:\/\//.test(process.env.S3_PUBLIC_URL) ? process.env.S3_PUBLIC_URL : `https://${process.env.S3_PUBLIC_URL}`}`.replace(/\/$/, '');

			const fileUrl = new URL(`${origin}/${process.env.S3_BUCKET}/konecty.${namespace}/${document}/${recordId}/${fieldName}/${fixedEncodeURIComponent(fileName)}`);

			const { status, data, headers } = await axios({ method: 'GET', url: fileUrl.toString(), responseType: 'stream' });
			originData = data;
			res.setHeader('Content-Type', headers['content-type']);
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
			const contentType = await detectContentType(origin);
			console.log(contentType);
			originData = createReadStream(origin);
			res.setHeader('Content-Type', contentType);
			res.setHeader('Cache-Control', 'public, max-age=' + expiration);
		}

		if (preprocess != null) {
			let preprocessBuffer;

			if (/^s3$/i.test(process.env.STORAGE)) {
				const { status, data } = await axios({
					method: 'GET',
					url: `${origin}/${process.env.S3_BUCKET}/konecty.${namespace}/${preprocess}.png`,
					responseType: 'arraybuffer',
				});
				if (status === 200) {
					preprocessBuffer = data;
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
