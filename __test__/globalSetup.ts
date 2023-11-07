import { MongoMemoryReplSet } from 'mongodb-memory-server';

import usersFixture from './fixtures/mongodb/jest/users.json';

declare global {
	// eslint-disable-next-line no-var
	var __MONGOINSTANCE: MongoMemoryReplSet;
}

export default async function globalSetup() {
	const instance = await MongoMemoryReplSet.create({
		replSet: { count: 1, dbName: 'jest', storageEngine: 'wiredTiger' },
		instanceOpts: [
			{
				port: 27019,
			},
		],
	});
	process.env.MONGO_URL = 'mongodb://127.0.0.1:27019/jest?replicaSet=testset';
	process.env.DISABLE_SENDMAIL = 'true';
	process.env.DISABLE_KONSISTENT = 'true';
	process.env.UI_URL = 'https://ui.konecty.com';
	global.__MONGOINSTANCE = instance;

	const uri = instance.getUri();

	console.info(`\n✅ MongoDB is running at ${uri}`);

	const db = (await import('@imports/database')).db;

	await db.collection('users').insertMany(usersFixture as any[]);

	console.info(`\n✅ Loaded ${usersFixture.length} users`);

	const app = (await import('@server/app')).default;

	await app();

	await new Promise(resolve => setTimeout(resolve, 1000));

	console.info(`\n✅ Started app`);
}
