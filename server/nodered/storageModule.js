import kebabCase from 'lodash/kebabCase';

import getCollection from './getCollection';

const FLOWS_COLLECTION = 'Flows';

const BASE_PATH = `/${process.env.NR_NAMESPACE || 'flows'}`;

const save = async (type, path, body, meta) => {
	const flowCollection = await getCollection(FLOWS_COLLECTION);

	await flowCollection.updateOne(
		{ type, path },
		{ $set: { body: JSON.stringify(body), meta: JSON.stringify(meta) }, $setOnInsert: { type, path } },
		{ upsert: true },
	);
};

const find = async (type, path, defaultValue = {}) => {
	const flowCollection = await getCollection(FLOWS_COLLECTION);

	const { body } = (await flowCollection.findOne({ type, path })) || {};

	if (body) {
		return JSON.parse(body);
	}
	return defaultValue;
};

const generateToken = length => {
	const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
	let result = '';
	for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
	return result;
};

export default {
	init: async (settings, runtime) => {
		const flowCollection = await getCollection(FLOWS_COLLECTION);
		flowCollection.createIndex({ type: 1, path: 1 }, { unique: 1 });

		const flows = await find('flows', BASE_PATH, []);
		const configNode = flows.find(({ id }) => id === 'konecty-embedded-server');
		let hashedToken;

		if (configNode == null) {
			const userCollection = await getCollection('users');
			const username = kebabCase(`${process.env.KONMETA_NAMESPACE}-nr-${process.env.NR_NAMESPACE}`);

			let flowUser = await userCollection.findOne({ username });

			if (flowUser != null) {
				try {
					const {
						services: {
							resume: {
								loginTokens: [{ hashedToken: token }],
							},
						},
					} = flowUser;

					hashedToken = token;
				} catch (error) {
					console.error('NR storageModule');
					console.error(error);
				}
			} else {
				hashedToken = generateToken(24);
				const name = `Nodered ${process.env.KONMETA_NAMESPACE} ${process.env.NR_NAMESPACE} user`;
				const now = new Date();
				const expire = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());

				const flowUser = {
					_id: username,
					name,
					username,
					locale: process.env.KONDATA_ADMIN_LOCALE || 'en',
					active: true,
					admin: true,
					_createdAt: new Date(),
					_createdBy: {
						_id: username,
						name,
					},
					_updatedAt: new Date(),
					_updatedBy: {
						_id: username,
						name,
						ts: new Date(),
					},
					_user: [
						{
							_id: username,
							name,
							active: true,
						},
					],
					access: {
						defaults: ['Full'],
					},
					services: {
						resume: {
							loginTokens: [
								{
									when: expire,
									hashedToken,
								},
							],
						},
					},
				};
				await userCollection.insertOne(flowUser);
			}
			flows.push({
				id: 'konecty-embedded-server',
				type: 'konecty-server',
				z: '',
				name: `Konecty ${process.env.KONMETA_NAMESPACE} ${process.env.NR_NAMESPACE}`,
				key: hashedToken,
				host: `http://localhost:${process.env.PORT}`,
			});
			await save('flows', BASE_PATH, flows);
			console.log('flows', flows);
		}
	},
	getFlows: async () => {
		return find('flows', BASE_PATH, []);
	},
	saveFlows: flows => {
		return save('flows', BASE_PATH, flows);
	},
	getCredentials: async () => {
		return find('credentials', BASE_PATH);
	},
	saveCredentials: credentials => {
		return save('credentials', BASE_PATH, credentials);
	},
	getSettings: async () => {
		return find('settings', BASE_PATH);
	},
	saveSettings: settings => {
		return save('settings', BASE_PATH, settings);
	},
	getSessions: () => {
		return find('sessions', BASE_PATH);
	},
	saveSessions: sessions => {
		return save('sessions', BASE_PATH, sessions);
	},
	getLibraryEntry: (type, path) => {
		return find(`library-${type}`, `${BASE_PATH}${path}`, []);
	},
	saveLibraryEntry: (type, path, meta, body) => {
		return save(`library-${type}`, `${BASE_PATH}${path}`, body, meta);
	},
};
