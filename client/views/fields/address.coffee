Template.fieldAddress.helpers
	format: (value) ->
		renderers.address value, this.field

Template.fieldAddress.events
	'click konecty-display': ->
		Modal.open('modalAddress', this.value)
