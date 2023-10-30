import { MongoMemoryReplSet } from 'mongodb-memory-server';

declare global {
	// eslint-disable-next-line no-var
	var __MONGOINSTANCE: MongoMemoryReplSet;
}

export default async function globalSetup() {
	process.env.MONGO_URL = 'mongodb://127.0.0.1:27019/jest';
	process.env.METADATA_DIR = '../src/private/metadata';
	process.env.DISABLE_SENDMAIL = 'true';
	process.env.DISABLE_KONSISTENT = 'true';
	process.env.UI_URL = 'https://ui.konecty.com';
	process.env.MONGO_DB = 'jest';
	const instance = await MongoMemoryReplSet.create({
		replSet: { count: 1 },
		instanceOpts: [
			{
				port: 27019,
			},
		],
	});
	global.__MONGOINSTANCE = instance;
	const uri = instance.getUri();

	console.info(`\n✅ MongoDB is running at ${uri}`);
	// try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const app = require('../src/server/app').default;
	await app();
	// } catch (error) {
	// 	console.error(error);
	// }
}
