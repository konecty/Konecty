// @Alert = (->

// 	component = null

// 	set = (templateName, data={}) ->
// 		init()
// 		Session.set("alertTemplate", templateName)
// 		Session.set("alertData", data)

// 	prompt = (params) ->
// 		component?.prompt params

// 	alert_ = (params) ->
// 		component?.alert params

// 	confirm = (params) ->
// 		component?.confirm params

// 	init = ->
// 		if component?
// 			return
// 		component = document.querySelector("konecty-alert")
// 		component.addEventListener 'close', ->
// 			Session.set("alertTemplate", undefined)
// 			Session.set("alertData", {})

// 	init: init
// 	set: set
// 	alert: alert_
// 	confirm: confirm
// 	prompt: prompt
// )()