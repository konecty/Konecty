import axios from 'axios';

import fixedEncodeURIComponent from './urlencode_u300';

const expiration = 31536000;
const corsFileTypes = ['png', 'jpg', 'gif', 'jpeg', 'webp'];

app.get('(/rest/file|/file|/rest/image|/image)/:mode(preview|download)?/:namespace/:metaDocumentId/:recordId/:fieldName/:fileName', async (req, res) => {
	try {
		const { mode, namespace, metaDocumentId, recordId, fieldName, fileName } = req.params;

		const origin = `${/https?:\/\//.test(process.env.S3_PUBLIC_URL) ? process.env.S3_PUBLIC_URL : `https://${process.env.S3_PUBLIC_URL}`}`.replace(/\/$/, '');

		const fileUrl = new URL(`${origin}/${process.env.S3_BUCKET}/konecty.${namespace}/${metaDocumentId}/${recordId}/${fieldName}/${fixedEncodeURIComponent(fileName)}`);

		const { status, data, headers } = await axios({ method: 'GET', url: fileUrl.toString(), responseType: 'stream' });

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
		if (mode === 'download') {
			res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
		}

		res.setHeader('Content-Type', headers['content-type']);

		data.pipe(res);
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
