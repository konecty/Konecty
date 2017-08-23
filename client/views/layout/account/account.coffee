Template.account.helpers
	tabTemplate: ->
		return Session.get "account-tab"
	status: ->
		return "hidden" if not Session.get "account-status"

Template.account.events
	"click .link": (e) ->
		Account.open(e.currentTarget)
	"click .close": (e) ->
		Account.close()
