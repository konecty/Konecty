@Login = (->

	login = {}
	logging = false

	wait = (time, callback) ->
		if new Date().getTime() - time < 2000
			setTimeout ->
				callback()
			, 200
			return false
		return true

	load = ->
		login.started = new Date().getTime()
		login.submit.addClass "active"
		login.submit.find("span").html login.submit.data "wait"

	unload = (err) ->
		ok = wait login.started, ->
			unload err
		return unless ok
		login.submit.addClass "finished"
		setTimeout ->
			if err
				login.submit.addClass "done"
				setTimeout ->
					login.submit.removeClass "finished active"
					login.submit.find("span").html login.submit.defaultText
					error "Revise seu nome de usuário e senha"
					setTimeout ->
						login.submit.removeClass "done"
					, 10
				, 10
			else
				logging = false
		, 300

	keyDown = (e) ->
		key = e.which()
		if key == 13
			e.preventDefault()
			e.stopPropagation()
			submit()

	validate = ->
		if not login.user.val().length or not login.pass.val().length
			return false
		return true

	error = (msg) ->
		login.status.addClass "error blink-background"
		login.status.html msg
		setTimeout ->
			login.status.removeClass "blink-background"
			logging = false
		, 1000

	submit = (e) ->
		return if logging
		logging = true
		unless validate()
			error "Você deve preencher os campos de login e senha"
		else
			load()
			Meteor.loginWithPassword login.user.val(), login.pass.val(), (err) ->
				if err? and err.error?
					unload err.error
				else
					unload()

	start = ->
		if login
			login.removeClass "hidden"

	init = ->
		login = $("#konecty-login")
		login.submit = login.find("button")
		login.user = login.find("input[name=user]")
		login.pass = login.find("input[name=password]")
		login.status = login.find("p")
		login.submit.defaultText = login.submit.find("span").html()

	init: init
	start: start
	submit: submit
)()