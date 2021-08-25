import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

import { Models } from 'metadata';

import { SHA256 } from './sha256';
import { randomSecret } from './index';

const BCRYPT_ROUNDS = 10;

const hash = (token, saltBase64, iterations) => {
	const salt = Buffer.from(saltBase64, 'base64');
	let result = createHash('sha256').update(salt).update(token).digest();
	iterations--;

	while (iterations > 0) {
		iterations--;
		result = createHash('sha256').update(result).digest();
	}

	return result.toString('base64');
};

const equals = (storedPassword, token) => {
	const array = storedPassword.split('$');
	let iterations = array[array.length - 3];
	const salt = array[array.length - 2];
	const password = array[array.length - 1];
	iterations = parseInt(iterations);
	token = this.hash(token, salt, iterations);

	return token === password;
};

const generateSalt = () => randomBytes(16).toString('base64');

const encrypt = (value, iterations) => {
	if (!iterations) {
		iterations = 1;
	}
	const salt = generateSalt();
	const password = hash(value, salt, iterations);

	return `$shiro1$SHA-256$${iterations}$${salt}$${password}`;
};

const hashLoginToken = loginToken => {
	const hash = createHash('sha256');
	hash.update(loginToken);
	return hash.digest('base64');
};

const getPasswordString = password => {
	if (typeof password === 'string') {
		password = SHA256(password);
	} else {
		// 'password' is an object
		if (password.algorithm !== 'sha-256') {
			throw new Error('Invalid password hash algorithm. ' + "Only 'sha-256' is allowed.");
		}
		password = password.digest;
	}
	return password;
};

const hashPassword = async password => {
	password = getPasswordString(password);
	return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

const setPassword = async (userId, newPlaintextPassword, options) => {
	options = { logout: true, ...options };

	const user = await Models.User.findOne({ _id: userId }, { projection: { _id: true } });

	if (!user) {
		throw new Error('[password] User not found');
	}

	const update = {
		$unset: {
			'services.password.srp': 1,
			'services.password.reset': 1,
		},
		$set: { 'services.password.bcrypt': await hashPassword(newPlaintextPassword) },
	};

	if (options.logout) {
		update.$unset['services.resume.loginTokens'] = 1;
	}

	await Models.User.update({ _id: user._id }, update);
};

const getRoundsFromBcryptHash = hash => {
	let rounds;
	if (hash) {
		const hashSegments = hash.split('$');
		if (hashSegments.length > 2) {
			rounds = parseInt(hashSegments[2], 10);
		}
	}
	return rounds;
};

const checkPassword = async (user, password) => {
	const result = {
		userId: user._id,
	};

	const formattedPassword = getPasswordString(password);
	const hash = user.services.password.bcrypt;
	const hashRounds = getRoundsFromBcryptHash(hash);
	const isPasswordEqual = await bcrypt.compare(formattedPassword, hash);
	if (!isPasswordEqual) {
		result.error = new Error('Incorrect password');
	} else if (hash && BCRYPT_ROUNDS != hashRounds) {
		// The password checks out, but the user's bcrypt hash needs to be updated.
		const newHash = await bcrypt.hash((formattedPassword, BCRYPT_ROUNDS));
		await Models.User.update(
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
