import crypto from 'crypto';

const getFileMD5 = (file: Buffer) => {
	const hash = crypto.createHash('md5');
	hash.update(file);
	return hash.digest('hex');
};

export default getFileMD5;
