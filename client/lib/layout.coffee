@Layout = (->

	foxy = undefined

	mainMenu = (->
		click = (el) ->
			subMenu.open()
		click: click
	)()

	updateMainColor = (el) ->
		if el
			item = $(el).parents(".item")
		else
			item = foxy.find(".main-nav li.active")
		if item.length
			if item.attr("data-color")
				if foxy.get(0).className.match(/colored/i)
					foxy.get(0).className = foxy.get(0).className.replace(/colored-[a-z0-9]+/i,"colored-" + item.attr("data-color"))
				else
					foxy.get(0).className += "colored-" + item.attr("data-color")

	subMenu = (->
		element = null
		opened = true
		triggerFirst = ->
			window.location.href = element.find(".sec-nav a").get(0).href
		toggle = ->
			if opened then close() else open()
		open = ->
			opened = true
			foxy.removeClass("submenu-closed")
		close = ->
			opened = false
			foxy.addClass("submenu-closed")
		set = ->
			element = foxy.find(".page-menu")
		isOpened = ->
			return opened

		triggerFirst: triggerFirst
		isOpened: isOpened
		toggle: toggle
		open: open
		close: close
		set: set
	)()

	filters = (->
		element = null
		opened = true
		toggle = ->
			if opened then close() else open()
		open = ->
			opened = true
			foxy.removeClass("filters-closed")
		close = ->
			opened = false
			foxy.addClass("filters-closed")
		set = ->
			element = foxy.find(".page-filters")

		isOpened = ->
			return opened

		isOpened: isOpened
		toggle:toggle
		open: open
		close: close
		set: set
	)()

	view = (->
		element = null
		opened = true
		toggle = ->
			if opened then close() else open()
		open = ->
			opened = true
			foxy.removeClass("view-closed")
		close = ->
			opened = false
			foxy.addClass("view-closed")
		set = ->
			element = foxy.find(".page-view")

		isOpened = ->
			return opened

		isOpened: isOpened
		toggle:toggle
		open: open
		close: close
		set: set
	)()

	closeAny = ->
		if foxy.main.outerWidth() < 320
			if subMenu.isOpened()
				console.log "FECHANDO 1"
				subMenu.close()
				closeAny()
				return
			if filters.isOpened()
				console.log "FECHANDO 2"
				filters.close()
				closeAny()
				return
			if view.isOpened()
				console.log "FECHANDO 3"

				view.close()
				closeAny()
				return
		return

	resize = (->
		win = $(window);
		apply = ->
			console.log foxy.main.outerWidth()
			if foxy.main.outerWidth() < 320
				closeAny()
		bind = ->
			win.bind "resize.layout", ->
				apply()
		bind: bind
		apply: apply
	)()

	update = ->
		foxy = $("#foxy")
		foxy.main = foxy.find(".page-main")
		# console.log(foxy.main)
		subMenu.set()
		filters.set()
		view.set()

	updateMainColor: updateMainColor
	mainMenu: mainMenu
	resize: resize
	update: update
	view: view
	filters: filters
	subMenu: subMenu
)()