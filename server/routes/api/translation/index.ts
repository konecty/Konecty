import { app } from '../../../lib/routes/app';

app.get('/api/translation', (req: any, res: any) => {
	// TODO: fix types
	res.send('Hello World!');
});
