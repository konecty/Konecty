import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

import { Models } from 'metadata';

import { SHA256 } from './sha256';
import { randomSecret } from './index';

const BCRYPT_ROUNDS = 10;

const interactOverHash = (hash, round) => {
	if (round > 0) {
		return interactOverHash(createHash('sha256').update(hash).digest(), round - 1);
	}
	return hash;
};

const hash = (token, saltBase64, iterations) => {
	const salt = Buffer.from(saltBase64, 'base64');
	const result = interactOverHash(createHash('sha256').update(salt).update(token).digest(), iterations);
	return result.toString('base64');
};

const equals = (storedPassword, token) => {
	const array = storedPassword.split('$');
	let iterations = array[array.length - 3];
	const salt = array[array.length - 2];
	const password = array[array.length - 1];
	iterations = parseInt(iterations, 10);
	return password === hash(token, salt, iterations);
};

const generateSalt = () => randomBytes(16).toString('base64');

const encrypt = (value, iterations = 1) => {
	const salt = generateSalt();
	const password = hash(value, salt, iterations);

	return `$shiro1$SHA-256$${iterations}$${salt}$${password}`;
};

const hashLoginToken = loginToken => createHash('sha256').update(loginToken).digest('base64');

const getPasswordString = password => {
	if (typeof password === 'string') {
		return SHA256(password);
	}
	// 'password' is an object
	if (password.algorithm !== 'sha-256') {
		throw new Error('Invalid password hash algorithm. ' + "Only 'sha-256' is allowed.");
	}
	return password.digest;
};

const hashPassword = async password => bcrypt.hash(getPasswordString(password), BCRYPT_ROUNDS);

const setPassword = async (userId, newPlaintextPassword) => {
	const user = await Models.User.findOne({ _id: userId }, { projection: { _id: true } });

	if (!user) {
		throw new Error('[password] User not found');
	}

	const update = {
		$unset: {
			'services.password.srp': 1,
			'services.password.reset': 1,
			'services.resume.loginTokens': true,
		},
		$set: { 'services.password.bcrypt': await hashPassword(newPlaintextPassword) },
	};

	// eslint-disable-next-line no-underscore-dangle
	await Models.User.update({ _id: user._id }, update);
};

const getRoundsFromBcryptHash = bcryptHash => {
	let rounds;
	if (bcryptHash) {
		const bcryptHashSegments = bcryptHash.split('$');
		if (bcryptHashSegments.length > 2) {
			rounds = parseInt(bcryptHashSegments[2], 10);
		}
	}
	return rounds;
};

const checkPassword = async (user, password) => {
	const result = {
		// eslint-disable-next-line no-underscore-dangle
		userId: user._id,
	};

	const formattedPassword = getPasswordString(password);
	const bcryptHash = user.services.password.bcrypt;
	const hashRounds = getRoundsFromBcryptHash(bcryptHash);
	const isPasswordEqual = await bcrypt.compare(formattedPassword, bcryptHash);

	if (isPasswordEqual === false) {
		result.error = new Error('Incorrect password');
	} else if (bcryptHash && BCRYPT_ROUNDS !== hashRounds) {
		// The password checks out, but the user's bcrypt hash needs to be updated.
		const newHash = await bcrypt.hash((formattedPassword, BCRYPT_ROUNDS));
		await Models.User.update(
			// eslint-disable-next-line no-underscore-dangle
			{ _id: user._id },
			{
				$set: {
					'services.password.bcrypt': newHash,
				},
			},
		);
	}

	return result;
};

const generateStampedLoginToken = () => ({
	token: randomSecret(),
	when: new Date(),
});

const hashStampedToken = stampedToken => {
	const { token, ...hashedStampedToken } = stampedToken;
	return {
		...hashedStampedToken,
		hashedToken: hashLoginToken(token),
	};
};

export { hash, equals, encrypt, hashLoginToken, setPassword, checkPassword, generateStampedLoginToken, hashStampedToken };
