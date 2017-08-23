@Grid = {}

@Grid.clearSelections = ->
	if document.selection and document.selection.empty
		document.selection.empty()
	else if window.getSelection
		sel = window.getSelection()
		sel.removeAllRanges()

@Grid.setCurrent = (element) ->
	current = element.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*)?/i,"$2$3")
	grid = document.querySelector(".grid")
	line = grid.querySelectorAll("tr." + current)
	selected = grid.querySelectorAll("tr.current")
	for i in selected
		i.className = i.className.replace(/(current)(\s)?/,"").trim()
	for i in line
		if not i.className.match(/current/)
			i.className = (i.className + " current").trim()
		else
			i.className = i.className.replace(/(current)(\s)?/,"").trim()

@Grid.cleanCurrent = ->
	current = document.querySelectorAll(".grid tr.current")
	for i in current
		i.className = i.className.replace(/(current)(\s)?/,"").trim()

@Grid.setSelected = (element) ->
	current = element.parentNode.parentNode.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*)?/i,"$2$3")
	grid = document.querySelector(".grid")
	line = grid.querySelectorAll("tr." + current)
	state = element.checked
	for i in line
		console.log line
		i.className = if state then (i.className + " selected").trim() else i.className.replace(/(selected)(\s)?/,"").trim()

@Grid.mouseEnter = (element) ->
	current = element.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*|$)/i,"$2$3")
	grid = document.querySelector(".grid")
	line = grid.querySelectorAll("tr." + current)
	if not element.className.match("hover")
		for i in line
			i.className = (i.className + " hover").trim()

@Grid.mouseLeave = (element) ->
	current = element.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*|$)/i,"$2$3")
	grid = document.querySelector(".grid")
	line = grid.querySelectorAll("tr." + current)
	if element.className.match("hover")
		for i in line
			i.className = i.className.replace(/(hover)(\s)?/,"").trim()

@Grid.toggleCheckbox = (element) ->
	current = element.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*|$)/i,"$2$3")
	grid = document.querySelector(".grid")
	checkbox = grid.querySelector("tr."+current+" konecty-checkbox")
	if checkbox
		checkbox.toggle()
	@clearSelections()


@Grid.toggleAll = (element) ->
	grid = document.querySelector(".grid")
	lines = grid.querySelectorAll(".body konecty-checkbox")
	all = false
	for i in lines
		if i.checked == false
			all = true
			break
	for i in lines
		i.checked = all