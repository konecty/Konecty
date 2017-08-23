# Converted to method
app.get '/rest/menu/list', (req, res, next) ->
	res.send Meteor.call 'menu',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
