import crypto from 'crypto';

const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
const BASE64_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789-_';

const hexString = digits => {
	const numBytes = Math.ceil(digits / 2);
	let bytes;
	try {
		bytes = crypto.randomBytes(numBytes);
	} catch (e) {
		bytes = crypto.pseudoRandomBytes(numBytes);
	}
	const result = bytes.toString('hex');
	return result.substring(0, digits);
};

const fraction = () => {
	const numerator = Number.parseInt(hexString(8), 16);
	return numerator * 2.3283064365386963e-10; // 2^-3;
};

const choice = arrayOrString => {
	const index = Math.floor(fraction() * arrayOrString.length);
	if (typeof arrayOrString === 'string') {
		return arrayOrString.substr(index, 1);
	}
	return arrayOrString[index];
};

export const randomString = (charsCount, alphabet) => {
	let result = '';
	for (let i = 0; i < charsCount; i++) {
		result += choice(alphabet);
	}
	return result;
};

export const randomId = () => randomString(17, UNMISTAKABLE_CHARS);

export const randomPassword = (charsCount = 6) => randomString(charsCount, UNMISTAKABLE_CHARS);

export const randomSecret = (charsCount = 43) => randomString(charsCount, BASE64_CHARS);
