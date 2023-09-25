import busboy from 'busboy';
import { logger } from '/imports/utils/logger';

const processMultipart = req =>
	new Promise((resolve, reject) => {
		let partsCount = 0;
		const bb = busboy({ headers: req.headers });
		bb.on('file', function (_, file, info) {
			const { filename, encoding } = info;

			const bufs = [];
			file.on('data', (data) => bufs.push(data));

			file.on('end', () => {
				let buffer = Buffer.concat(bufs);

				if (encoding !== '7bit') {
					buffer = new Buffer.from(buffer.toString('utf8'), encoding);
				}
				resolve({ filename: decodeURI(filename), buffer });
			});
		});

		bb.on('error', err => {
			logger.error(err, `Error processing multipart request: ${err.message}`);
			reject(err);
		});

		bb.on('end', function () {
			if (partsCount === 0) {
				reject({ message: 'Bad request' });
			}
		});

		req.pipe(bb);
	});

const processUrlencoded = req =>
	new Promise((resolve, reject) => {
		const bufs = [];
		req.on('data', data => bufs.push(data));

		req.on('end', () => {
			const buffer = Buffer.concat(bufs);
			const filename = decodeURI(req.get('x-file-name'));
			resolve({ filename, buffer });
		});

		req.on('error', () => {
			reject({ message: 'Bad request' });
		});
	});

export default async req => {
	let fileContent, fileName;
	if (req.get('content-type') === 'application/x-www-form-urlencoded') {
		const urlEncodedResult = await processUrlencoded(req);
		fileContent = urlEncodedResult.buffer;
		fileName = urlEncodedResult.fileName;
	} else {
		const multipartResult = await processMultipart(req);
		fileContent = multipartResult.buffer;
		fileName = multipartResult.filename;
	}

	return { fileContent, fileName };
};
