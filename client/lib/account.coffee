@Account = (->

	currentTab = ->

	Session.set 'account-status', false

	open = (element) ->
		switch element.icon
			when "plus"
				Session.set('account-tab', "accountLinks")
			when "gear"
				Session.set('account-tab', "accountConfiguration")
			when "bell"
				Session.set('account-tab', "accountNotifications")

		Session.set('account-status', true)
	close = ->
		Session.set('account-status', false)

	open: open
	close: close
	currentTab: currentTab

)()
