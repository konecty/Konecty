menuColors = [
	"materialBlue"
	"materialGreen"
	"materialRed"
	"materialAmber"
	"materialDeepOrange"
	"materialDeepPurple"
	"materialOrange"
	"materialLime"
]

applyedColors = {}

Template.menu.helpers
	getRandomColor: (item) ->
		if not applyedColors[item._id]
			applyedColors[item._id] = _.sample menuColors

		return applyedColors[item._id]

	menu: ->
		query =
			type: 'document'
			menuSorter: $gt: 0
			group: $exists: false
		options =
			sort:
				menuSorter: 1
				_id: 1

		return Menu.find query, options

	menuHasSubItems: (_id) ->
		query =
			document: _id
			type: $in: ['list', 'pivot']

		return Menu.find(query).count() > 0

	isCurrentMenu: (_id) ->
		return Session.get('main-menu-active') is _id

	isCurrentSubMenu: (_id) ->
		return Session.get('main-submenu-active') is _id

	subMenuLists: (_id) ->
		query =
			document: _id
			group: $exists: false
			type: 'list'

		return Menu.find(query).fetch()

	subMenuPreferenceLists: (_id) ->
		query =
			document: _id
			target: 'Display'
			type: 'list'

		return Models.Preference?.find(query).fetch()

	subMenuReports: (_id) ->
		query =
			document: _id
			group: $exists: false
			type: 'pivot'

		return Menu.find(query).fetch()

	subMenuPreferenceReports: (_id) ->
		query =
			document: _id
			target: 'Display'
			type: 'pivot'

		return Models.Preference?.find(query).fetch()

	subMenuModules: (_id) ->
		query =
			group: _id

		return Menu.find(query).fetch()

Template.menu.events
	"click .item > a": (e) ->
		parent = $(e.currentTarget).parent()
		nav = parent.find("nav")
		a = nav.find("a")
		p = nav.find("p")
		if parent.hasClass("opened")
			parent.removeClass("opened")
			nav.css("max-height", 0)
		else
			parent.addClass("opened").siblings().removeClass("opened")
			nav.css("max-height", a.outerHeight() * a.length + p.outerHeight() * p.length)
		# Layout.mainMenu.click(e.currentTarget)
		e.preventDefault()
		e.stopPropagation()

	"click .control": (e) ->
		Layout.subMenu.toggle()

	"click nav > a": (e) ->
		Layout.updateMainColor(e.currentTarget)

	"mouseenter .wrapper": (e) ->
		$(e.currentTarget).parent().addClass("hover")
	"mouseleave .wrapper": (e) ->
		$(e.currentTarget).parent().removeClass("hover")
