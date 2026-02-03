export default async function globalTeardown() {
	const instance = global.__MONGOINSTANCE;
	if (instance != null) {
		await instance.stop();
	}
	// Do not call process.exit(0); let Jest exit normally so all afterEach/afterAll hooks complete first.
}
