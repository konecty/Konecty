import { MongoClient } from 'mongodb';

let connection = null;

export default class Db {
	static async getConnection() {
		if (connection != null) {
			return connection;
		}

		const db = await MongoClient.connect(process.env.KONMETA_DB_URL);

		db.on('close', () => {
			connection = null;
		});

		connection = db;

		return connection;
	}
}
