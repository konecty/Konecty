import crypto from 'crypto';
import bcrypt from 'bcrypt';
import getCollection from './getCollection';

const SHA256 = password =>
	crypto
		.createHash('sha256')
		.update(password)
		.digest('hex');

export default {
	type: 'credentials',
	users: async username => {
		return { username, permissions: '*' };
	},
	authenticate: async (username, password) => {
		try {
			const userCollection = await getCollection('users');
			const user = await userCollection.findOne(
				{ username, 'services.password.bcrypt': { $exists: true } },
				{ projection: { 'services.password.bcrypt': true } },
			);
			if (user != null) {
				const {
					services: {
						password: { bcrypt: hash },
					},
				} = user;
				const hashedPassword = SHA256(password);
				const valid = await bcrypt.compare(hashedPassword, hash);
				if (valid) {
					return {
						username,
						permissions: '*',
					};
				}
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	},
};
