export default async function globalSetup() {
	process.env.MONGO_URL = 'mongodb://localhost:27017/jest';
	process.env.MONGO_DB = 'jest';
}
