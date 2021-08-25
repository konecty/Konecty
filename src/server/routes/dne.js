import { callMethod } from 'utils/methods';

export default app => {
	/* @CEP_List */
	// Converted to method
	app.get('/rest/dne/cep/:cep', async (req, res) => {
		const result = await callMethod('DNE_CEP_List', req.params.cep);
		res.send(result);
	});

	/* @City_List */
	// Converted to method
	app.get('/rest/dne/BRA/:state/:city', async (req, res) => {
		const result = await callMethod('DNE_City_List', req.params.state, req.params.city);
		res.send(result);
	});

	/* @District_List */
	// Converted to method
	app.get('/rest/dne/BRA/:state/:city/:district', async (req, res) => {
		const result = await callMethod('DNE_District_List', req.params.state, req.params.city, req.params.district);
		res.send(result);
	});

	/* @Place_List */
	// Converted to method
	app.get('/rest/dne/BRA/:state/:city/:district/:place/:number?/:limit?', async (req, res) => {
		const result = await callMethod('DNE_Place_List', req.params.state, req.params.city, req.params.district, req.params.place, req.params.number, req.params.limit);
		res.send(result);
	});
};
