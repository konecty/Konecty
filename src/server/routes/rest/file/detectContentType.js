// import { Magic, MAGIC_MIME_TYPE } from 'mmmagic';

export default buf => {
	// const magic = new Magic(MAGIC_MIME_TYPE);
	const magic = {};
	return new Promise((resolve, reject) => {
		if (typeof buf === 'string') {
			magic.detectFile(buf, (err, contentType) => {
				if (err) {
					reject(err);
				} else {
					resolve(contentType);
				}
			});
		} else {
			magic.detect(buf, (err, contentType) => {
				if (err) {
					reject(err);
				} else {
					resolve(contentType);
				}
			});
		}
	});
};
