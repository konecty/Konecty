@Tables = (->

	table = {}

	updateSize = () ->
		# tem que somar o tamanho do scroll aqui, em ambos;
		table.limitX = table.main.body.table.get(0).offsetWidth - table.main.body.get(0).offsetWidth
		table.limitY = table.main.body.table.get(0).offsetHeight - table.main.body.get(0).offsetHeight

	updateScrollY = (e) ->
		updateSize()
		table.main.scrollY -= e.deltaY
		if table.main.scrollY > table.limitY
			table.main.scrollY = table.limitY
		if table.main.scrollY < 0
			table.main.scrollY = 0
		table.left.body.scrollTop(table.main.scrollY)
		table.main.body.scrollTop(table.main.scrollY)

	updateScrollX = (e) ->
		updateSize()
		table.main.scrollX += e.deltaX
		if table.main.scrollX > table.limitX
			table.main.scrollX = table.limitX
		if table.main.scrollX < 0
			table.main.scrollX = 0
		table.main.header.scrollLeft(table.main.scrollX)
		table.main.body.scrollLeft(table.main.scrollX)

	scrollEvents = ->
		table.main.body.bind "scroll", (e) ->
			table.main.scrollY = table.main.body.scrollTop()
			table.main.scrollX = table.main.body.scrollLeft()
			table.main.header.scrollLeft(table.main.scrollX)
			table.left.body.scrollTop(table.main.scrollY)

		table.left.body.bind "mousewheel", (e) ->
			if Math.abs(e.deltaY) > 0
				updateScrollY(e)
			if Math.abs(e.deltaX) > 0
				updateScrollX(e)

		table.main.header.bind "mousewheel", (e) ->
			if Math.abs(e.deltaX) > 0
				updateScrollX(e)

	init = (element) ->
		table = $(element)
		table.left = table.find(".left")
		table.left.body = table.left.find(".body")
		table.main = table.find(".main")
		table.main.body = table.main.find(".body")
		table.main.header = table.main.find("header")
		table.main.body.table = table.main.body.find("table")

		table.main.scrollY = 0
		table.main.scrollX = 0
		scrollEvents()
	init: init

)()