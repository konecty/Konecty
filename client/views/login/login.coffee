Template.login.events
	"click .submit button": ->
		Login.submit()

	"keydown li input": (e) ->
		if e.which == 13
			e.preventDefault()
			Login.submit()

	"focus li input": (e) ->
		ipt = $(e.currentTarget);
		ipt.parent().addClass("focus")

	"blur li input": (e) ->
		ipt = $(e.currentTarget);
		if not ipt.val()
			ipt.parent().removeClass("focus hovered")

	"click li label": (e) ->
		lbl = $(e.currentTarget)
		lbl.next().focus()

	"mouseenter li": (e) ->
		lbl = $(e.currentTarget)
		lbl.addClass "hovered"

	"mouseleave li": (e) ->
		lbl = $(e.currentTarget)
		if not lbl.hasClass("focus")
			lbl.removeClass "hovered"

Template.login.rendered = ->
	Login.init()
	setTimeout ->
		Login.start()
	, 1000