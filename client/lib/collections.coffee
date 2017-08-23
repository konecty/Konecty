@Menu = new Meteor.Collection 'Menu'

processViewMappings = (doc) ->
	doc.groupsMap = {}
	if doc.groups?
		for group in doc.groups
			group.visuals = []
			group.visualsMap = {}
			doc.groupsMap[group.name] = group

	doc.visualsMap = {}
	if doc.visuals?
		for visual in doc.visuals
			doc.visualsMap[visual.name] = visual
			if doc.groupsMap[visual.group]?
				doc.groupsMap[visual.group].visuals.push visual
				doc.groupsMap[visual.group].visualsMap[visual.name] = visual

processListMappings = (doc) ->
	doc.columnsMap = doc.columns
	doc.columns = []
	if doc.columnsMap?
		for key, column of doc.columnsMap
			doc.columns.push column

@Menu.find().observe
	added: (doc) ->
		if doc.type is 'view'
			processViewMappings Menu._collection._docs._map[doc._id]
		if doc.type is 'list'
			processListMappings Menu._collection._docs._map[doc._id]
	changed: (doc) ->
		if doc.type is 'view'
			processViewMappings Menu._collection._docs._map[doc._id]
		if doc.type is 'list'
			processListMappings Menu._collection._docs._map[doc._id]