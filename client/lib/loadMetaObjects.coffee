# Meteor.startup ->

MetaObject.find({type: 'document'}).observe
	added: (meta) ->
		unless Models[meta.name]
			Models[meta.name] = new Meteor.Collection "data.#{meta.name}"
			Models["#{meta.name}.History"] = new Meteor.Collection "data.#{meta.name}.History"
			Models["#{meta.name}Editing"] = new Meteor.Collection null

	changed: (meta) ->
		unless Models[meta.name]
			Models[meta.name] = new Meteor.Collection "data.#{meta.name}"
			Models["#{meta.name}.History"] = new Meteor.Collection "data.#{meta.name}.History"
			Models["#{meta.name}Editing"] = new Meteor.Collection null

