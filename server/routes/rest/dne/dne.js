import { app } from '/server/lib/routes/app';
import { DNE_CEP_List, DNE_City_List, DNE_District_List, DNE_Place_List } from '/imports/dne';

/* @CEP_List */
// Converted to method
app.get('/rest/dne/cep/:cep', async function (req, res) {
	const result = await DNE_CEP_List(req.params.cep);
	res.send(result);
});

/* @City_List */
// Converted to method
app.get('/rest/dne/BRA/:state/:city', async function (req, res) {
	const result = await DNE_City_List(req.params.state, req.params.city);
	res.send(result);
});

/* @District_List */
// Converted to method
app.get('/rest/dne/BRA/:state/:city/:district', async function (req, res) {
	const result = await DNE_District_List(req.params.state, req.params.city, req.params.district);
	res.send(result);
});

/* @Place_List */
// Converted to method
app.get('/rest/dne/BRA/:state/:city/:district/:place/:number?/:limit?', async function (req, res) {
	const result = await DNE_Place_List(req.params.state, req.params.city, req.params.district, req.params.place, req.params.number, req.params.limit);
	res.send(result);
});
