import { MongoClient } from 'mongodb';
import querystring from 'node:querystring';

import { logger } from '../utils/logger';

const MONGODB_URL_REGEX = /^(mongodb|mongodb\+srv):\/\/(?:([^:]+):([^@]+)@)?([^/:]+)(?::(\d+))?\/([^?]+)(?:\?(.+))?$/;

const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';

const [, protocol, username, password, host, port, database, urioptions] = MONGO_URL.match(MONGODB_URL_REGEX) || [];

const options = querystring.parse(urioptions ?? {});

const getMongoUrl = () => {
	if (username != null && password != null) {
		if (protocol === 'mongodb+srv') {
			return `${protocol}://${username}:${password}@${host}/${database}`;
		}
		return `${protocol}://${username}:${password}@${host}:${port ?? 27017}`;
	}
	if (protocol === 'mongodb+srv') {
		return `${protocol}://${host}/${database}`;
	}
	return `${protocol}://${host}:${port ?? 27017}`;
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
