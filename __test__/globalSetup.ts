import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { Promise as BluebirdPromise } from 'bluebird';
import fs from 'fs/promises';
import path from 'node:path';

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
	process.env.DISABLE_REINDEX = 'true';
	process.env.PORT = '0';
	process.env.BASE_URL = 'http://127.0.0.1:3000/rest';
	process.env.UI_URL = 'https://ui.konecty.com';
	process.env.LOG_LEVEL = 'fatal';
	process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
	global.__MONGOINSTANCE = instance;

	const uri = instance.getUri();

	console.info(`\n✅ MongoDB is running at ${uri}`);

	try {
		await loadFixtures();

		const app = (await import('@server/app')).default;
		await app();

		await new Promise(resolve => setTimeout(resolve, 3000));

		console.info(`\n✅ Started app`);
	} catch (error) {
		console.error(`\n❌ Failed to start app, verify port 3000`);
		console.error(error);
	}
}

async function loadFixtures() {
	const fullPath = (localPath: string) => path.resolve(__dirname, localPath);

	const files = await fs.readdir(fullPath('./fixtures/mongodb/jest'));
	const db = (await import('@imports/database')).db;

	await BluebirdPromise.map(files, async file => {
		if (!file.endsWith('.json')) {
			return;
		}

		const collectionName = file.replace('.json', '');
		const collection = db.collection(collectionName);
		const data = await fs.readFile(fullPath(`./fixtures/mongodb/jest/${file}`), 'utf8');
		await collection.insertMany(JSON.parse(data));
		console.info(`\n✅ Loaded ${collectionName} fixtures`);
	});
}
