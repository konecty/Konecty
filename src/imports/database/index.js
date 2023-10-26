import { MongoClient } from 'mongodb';
import querystring from 'node:querystring';

import { logger } from '../utils/logger';

const MONGODB_URL_REGEX = /^mongodb:\/\/(?:([^:]+):([^@]+)@)?([^/:]+)(?::(\d+))?\/([^?]+)(?:\?(.+))?$/;

const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';

const [, username, password, host, port, database, urioptions] = MONGO_URL.match(MONGODB_URL_REGEX);

const options = querystring.parse(urioptions ?? {});

const getMongoUrl = () => {
	if (username != null && password != null) {
		return `mongodb://${username}:${password}@${host}:${port ?? 27017}`;
	}
	return `mongodb://${host}:${port ?? 27017}`;
};

const mongoUrl = getMongoUrl();

export const client = new MongoClient(mongoUrl, options);

export const db = client.db(database);

export const dneDB = client.db('utils');

client.on('error', err => {
	logger.error(err, `MongoDB connection error: ${err.message}`);
});

client.on('close', () => {
	logger.info('MongoDB connection closed');
});

client.on('connect', () => {
	logger.info('MongoDB connection opened');
});
