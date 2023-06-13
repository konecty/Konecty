import { app } from "/server/lib/routes/app";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.get('/api/translation', (_: unknown, res: any) => {
	// TODO: fix types
	res.send('Hello World!');
});
