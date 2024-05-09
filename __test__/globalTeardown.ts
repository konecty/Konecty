export default async function globalTeardown() {
	const instance = global.__MONGOINSTANCE;
	await instance.stop();
	process.exit(0);
}
