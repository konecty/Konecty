/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/* @CEP_List */
// Converted to method
app.get('/rest/dne/cep/:cep', (req, res, next) => res.send(Meteor.call('DNE_CEP_List', req.params.cep)));

/* @City_List */
// Converted to method
app.get('/rest/dne/BRA/:state/:city', (req, res, next) => res.send(Meteor.call('DNE_City_List', req.params.state, req.params.city)));

/* @District_List */
// Converted to method
app.get('/rest/dne/BRA/:state/:city/:district', (req, res, next) => res.send(Meteor.call('DNE_District_List', req.params.state, req.params.city, req.params.district)));

/* @Place_List */
// Converted to method
app.get('/rest/dne/BRA/:state/:city/:district/:place/:number?/:limit?', (req, res, next) => res.send(Meteor.call('DNE_Place_List', req.params.state, req.params.city, req.params.district, req.params.place, req.params.number, req.params.limit)));
