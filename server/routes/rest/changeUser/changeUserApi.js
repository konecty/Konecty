app.post('/rest/changeUser/:document/add', (req, res, next) =>
  res.send(
    Meteor.call('changeUser:add', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      ids: req.body.ids,
      users: req.body.data
    })
  )
);

app.post('/rest/changeUser/:document/remove', (req, res, next) =>
  res.send(
    Meteor.call('changeUser:remove', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      ids: req.body.ids,
      users: req.body.data
    })
  )
);

app.post('/rest/changeUser/:document/define', (req, res, next) =>
  res.send(
    Meteor.call('changeUser:define', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      ids: req.body.ids,
      users: req.body.data
    })
  )
);

app.post('/rest/changeUser/:document/replace', (req, res, next) =>
  res.send(
    Meteor.call('changeUser:replace', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      ids: req.body.ids,
      from: req.body.data.from,
      to: req.body.data.to
    })
  )
);

app.post('/rest/changeUser/:document/countInactive', (req, res, next) =>
  res.send(
    Meteor.call('changeUser:countInactive', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      ids: req.body.ids
    })
  )
);

app.post('/rest/changeUser/:document/removeInactive', (req, res, next) =>
  res.send(
    Meteor.call('changeUser:removeInactive', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      ids: req.body.ids
    })
  )
);

app.post('/rest/changeUser/:document/setQueue', (req, res, next) =>
  res.send(
    Meteor.call('changeUser:setQueue', {
      authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
      document: req.params.document,
      ids: req.body.ids,
      queue: req.body.data
    })
  )
);
