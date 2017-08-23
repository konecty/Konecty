import moment from 'moment';

@renderers =
	render: (value, field) ->
		if not renderers[field.type]?
			console.log "Renderer for type [#{type}] not found"
			return value

		if field.isList is true
			if _.isArray value
				return (renderers[field.type](item, field) for item in value)
			else
				return []

		return renderers[field.type](value, field)

	list: (value, field) ->
		if _.isArray(value) and value.length > 0
			return renderers[field.type](value[0], field)
		return ''

	boolean: (value, field) ->
		if value?
			return if value is true then 'Sim' else 'Não'

	autoNumber: (value, field) ->
		return value

	email: (value, field) ->
		if value?
			return "<a href=\"mailto:#{value.address}\">#{value.address}</a>"

	text: (value, field) ->
		return value

	richText: (value, field) ->
		return '<div class="cell-detail"><i class="fa fa-eye"></i></div>'

	json: (value, field) ->
		return '<div class="cell-detail"><i class="fa fa-eye"></i></div>'

	filter: (value, field) ->
		return '<div class="cell-detail"><i class="fa fa-eye"></i></div>'

	composite: (value, field) ->
		return '<div class="cell-detail"><i class="fa fa-eye"></i></div>'

	url: (value, field) ->
		if value?
			return "<a href=\"#{value}\">#{value}</a>"
		return ''

	personName: (value, field) ->
		return value?.full

	phone: (value, field) ->
		if value?
			phoneNumber = String(value.phoneNumber).replace(/(\d{2})(\d{4})(.+)/, '($1) $2-$3')
			return "<a href=\"callto:+#{value.countryCode}#{value.phoneNumber}\">+#{value.countryCode}&nbsp;#{phoneNumber}</a>"

	dateTime: (value, field) ->
		if value?
			return moment(value).format('L LT')

	date: (value, field) ->
		if value?
			return moment(value).format('L')

	time: (value, field) ->
		if value?
			return moment().startOf('day').add(value).format('LT')

	money: (value, field) ->
		if value?.value?.toFixed?
			formatedValue = value.value.toFixed(2).replace('.', ',')
			while /\d{4}[.,]/.test formatedValue
				formatedValue = formatedValue.replace(/(\d{1,})(\d{3})([,.])/, '$1.$2$3')
			return 'R$ ' + formatedValue
		return value

	number: (value, field) ->
		if value?.toFixed?
			fixed = if field.decimalSize? then field.decimalSize else 0
			formatedValue = value.toFixed(fixed).replace('.', ',')
			while /\d{6}[.,]/.test formatedValue
				formatedValue = formatedValue.replace(/(\d{3})(\d{3})([,.]|$)/, '$1.$2$3')
			return formatedValue

	percentage: (value, field) ->
		if value?.toFixed?
			fixed = if field.decimalSize? then field.decimalSize else 0
			value = value * 100
			formatedValue = value.toFixed(fixed).replace('.', ',')
			while /\d{6}[.,]/.test formatedValue
				formatedValue = formatedValue.replace(/(\d{3})(\d{3})([,.]|$)/, '$1.$2$3')
			return formatedValue + '%'

	picklist: (value, field) ->
		if field.maxSelected > 1
			if _.isArray value
				values = []
				for item in value
					values.push Blaze._globalHelpers.i18n field.options[item]
				return values.join ', '
		else
			return Blaze._globalHelpers.i18n field.options[value]
		return value

	address: (value, field) ->
		if not _.isObject value
			return value

		fields = ['place', 'number', 'complement', 'district', 'city', 'state', 'country', 'postalCode']
		countries =
			BRA: 'Brasil'
		values = []

		for field in fields
			if value[field]?
				if field is 'country'
					value[field] = countries[value[field]]

				values.push value[field]

		values = values.join(', ')

		if value.placeType?
			values = value.placeType + ' ' + values

		return values

	lookup: (value, field) ->
		if not _.isObject value
			return ''

		lookupDocument = Menu.findOne name: field.document, type: 'document'

		results = []
		for key in field.descriptionFields
			descriptionField = lookupDocument.fields[key.split('.')[0]]
			if not descriptionField?
				console.error "Description field [#{key}] dos not exists in meta [#{field.document}]"
				continue
			results.push renderers.render value[descriptionField.name], descriptionField

		recursive = (values) ->
			if not _.isArray values
				return values

			values.sort (a, b) ->
				return _.isArray a

			for value in values
				if _.isArray value
					value = "(#{recursive(value)}"

			return values.join ' - '

		results = recursive results

		return results
