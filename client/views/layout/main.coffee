Template.main.events
	"click .list li": (e) ->
		Layout.view.open()
	"click konecty-button[icon='filter']": (e) ->
		Layout.filters.toggle()
	"click konecty-button[icon='map-marker']": (e) ->
		Modal.open("modalAddress")

Template.main.rendered = ->
	Tables.init(document.querySelector("div.grid"))
	Tooltip.init(document.querySelector(".main-page"))