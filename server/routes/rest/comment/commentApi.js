// Converted to method
app.get('/rest/comment/:document/:dataId', (req, res, next) =>
  res.send(
    Meteor.call('comments:find', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      dataId: req.params.dataId
    })
  )
);

// Converted to method
app.post('/rest/comment/:document/:dataId', (req, res, next) =>
  res.send(
    Meteor.call('comments:create', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      text: req.body.text,
      dataId: req.params.dataId
    })
  )
);
