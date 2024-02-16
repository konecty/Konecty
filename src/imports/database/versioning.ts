import { logger } from '@imports/utils/logger';
import { db } from '.';

type ServerInfo = {
	version: string;
	versionArray: [major: number, minor: number, patch: number];
	ok: 1 | 0;
};

export const MONGO_VERSION = { major: 0, minor: 0, patch: 0 };

export default async function startDatabaseVersioning() {
	logger.info('Starting database versioning');
	const { version, versionArray } = (await db.admin().serverInfo()) as ServerInfo;

	logger.info(`MongoDB server version ${version}`);

	const [major, minor, patch] = versionArray;
	MONGO_VERSION.major = major;
	MONGO_VERSION.minor = minor;
	MONGO_VERSION.patch = patch;
}

export function applyIfMongoVersionGreaterThanOrEqual<T>(major: number, fn: () => T) {
	if (MONGO_VERSION.major >= major) {
		return fn();
	}

	return null;
}
