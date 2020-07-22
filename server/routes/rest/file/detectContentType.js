import { Magic, MAGIC_MIME_TYPE } from 'mmmagic';

export default (buf) => {
	const magic = new Magic(MAGIC_MIME_TYPE);
	return new Promise((resolve, reject) => {
		magic.detect(buf, (err, contentType) => {
			if (err) {
				reject(err);
			} else {
				resolve(contentType);
			}
		});
	});
};
