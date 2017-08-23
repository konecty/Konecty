@Tooltip = (->

	body = {}
	win = {}
	tip = null
	timer = null
	over = false

	create = (type) ->
		if not tip
			tip = $("<div/>").addClass(type)
			body.append tip
		else
			tip.get(0).className = type

	set = (text) ->
		if tip.hasClass "list"
			list = text.split ","
			text = "<ul>"
			for i in list
				text +="<li>" + i + "</li>"
			text += "</ul>"
		tip.html text

	setPosition = (el, dir, force) ->
		pos = el.offset()
		if dir is "left"
			top = pos.top - tip.outerHeight() / 2 + el.outerHeight() / 2
			left = pos.left - tip.outerWidth() - 4
			tip.removeClass("rigth top bottom").addClass("left")
		if dir is "top"
			top = pos.top - tip.outerHeight() - 4
			left = pos.left - tip.outerWidth() / 2 + el.outerWidth()/2
			tip.removeClass("rigth left bottom").addClass("top")
		if dir is "bottom"
			top = pos.top + el.outerHeight() + 4
			left = pos.left - tip.outerWidth() / 2 + el.outerWidth()/2
			tip.removeClass("rigth left top").addClass("bottom")
		if dir is "right"
			top = pos.top - tip.outerHeight() / 2 + el.outerHeight() / 2
			left = pos.left + el.outerWidth() + 4
			tip.removeClass("bottom left top").addClass("right")
		if not force
			if top < 0
				return setPosition el, "bottom", 1
			if left < 0
				return setPosition el, "right", 1
			if top + tip.outerHeight() > win.height()
				return setPosition el, "top", 1
			if left + tip.outerWidth() > win.width()
				return setPosition el, "left", 1
		return {
			top: top
			left: left
		}

	position = (el, tip) ->
		el = $(el)
		pos = null
		if tip.hasClass "left"
			pos = setPosition el, "left"
		if tip.hasClass "right"
			pos = setPosition el, "right"
		if tip.hasClass "top"
			pos = setPosition el, "top"
		if not pos
			pos = setPosition el, "top"

		tip.css
			top: pos.top + "px"
			left: pos.left + "px"

	enter = (params) ->
		el = params.el
		type = "tooltip"
		if el.getAttribute("tooltip-left")
			type += " left"
		if el.getAttribute("tooltip-right")
			type += " right"
		if el.getAttribute("tooltip-list")
			type += " list"
		if params.type
			type += " " + params.type

		text =  if params.text then params.text else el.getAttribute("tooltip") or el.getAttribute("tooltip-left") or el.getAttribute("tooltip-list") or el.getAttribute("tooltip-right")
		if text?.length
			create type
			set text
			position el, tip

	show = (params) ->
		if params.el and params.text
			enter params
			$(params.el).on "mouseleave", (e) ->
				leave(e)

	leave = (e) ->
		tip.addClass "hidden"

	bind = ->
		$('body')
			.on 'mouseenter', '*[tooltip], *[tooltip-left], *[tooltip-list], *[tooltip-right]', (e) ->
				if timer
					clearTimeout timer
					timer = null
				delay = if over then 0 else 750
				timer = setTimeout ->
					over = true
					timer = null
					enter
						el: e.currentTarget
				, delay

			.on 'mouseleave', '*[tooltip], *[tooltip-left], *[tooltip-list], *[tooltip-right]', (e) ->
				if timer
					clearTimeout timer
					timer = null
					return
				leave(e)
				timer = setTimeout ->
					over = false
					timer = null
				, 250

	init = (el) ->
		win = $(window)
		body = $("body")
		bind()

	init: init
	open: open
	close: close
	bind: bind
	show: show

)()