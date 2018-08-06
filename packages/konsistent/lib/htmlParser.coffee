@htmlParser: (doc) ->
  console.log 'Documento a ser parseado para HTML ->' doc
  parser = new DOMParser()
  return parser.parseFromString(doc, 'text/html')