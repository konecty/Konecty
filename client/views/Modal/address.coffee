Template.modalAddress.events
	"enter konecty-select": (e) ->
		$(e.currentTarget).next()?.focus();

	"enter konecty-text": (e) ->
		$(e.currentTarget).next()?.focus();

	"click konecty-button.action": ->
		alert "Action"

	"click konecty-button.close": ->
		Modal.close()

	"change konecty-select[name=country]": (e) ->
		console.log e.currentTarget.value

	"change konecty-select[name=state]": (e) ->
		console.log e.currentTarget.value

	"change konecty-select[name=city]": (e) ->
		console.log e.currentTarget.getSelected()

	"change konecty-select[name=district]": (e) ->
		console.log e.currentTarget.getSelected()

	"change konecty-select[name=place]": (e) ->
		selection = e.currentTarget.getSelected()
		if selection?.record?
			template = Template.instance()

			if _.isString selection.record.district
				districtField = template.$('konecty-select[name=district]')[0]
				if selection.record.district isnt districtField.getValue()
					districtField.items = [{
						name: selection.record.district
						value: selection.record.district
						record: selection.record
					}]
					districtField.setValue(selection.record.district)

			if _.isString selection.record.placeType
				template.$('konecty-select[name=placeType]')[0].setValue(selection.record.placeType)

			if _.isString selection.record.postalCode
				template.$('konecty-text[name=postalCode]')[0].setValue(selection.record.postalCode)

	"blur konecty-text[name=number]": (e) ->
		number = parseInt e.currentTarget.getValue()
		if _.isBlank number
			return

		template = Template.instance()

		postalCode = template.$('konecty-text[name=postalCode]')[0].getValue()

		if not _.isBlank postalCode
			return

		state = template.$('konecty-select[name=state]')[0].getValue()
		city = template.$('konecty-select[name=city]')[0].getValue()
		district = '*'
		place = template.$('konecty-select[name=place]')[0].getValue()
		limit = 2

		if _.isBlank city
			city = '*'

		Meteor.call 'DNE_Place_List', state, city, district, place, number, limit, (err, result) ->
			if err?
				return console.log err

			if _.isEmpty(result) or not _.isArray(result) or result.length is 0
				return

			result = result.filter (item) ->
				return item.place is place and item.city is city

			if result.length is 0
				return

			result = result[0]

			if _.isString result.district
				districtField = template.$('konecty-select[name=district]')[0]
				if result.district isnt districtField.getValue()
					districtField.items = [{
						name: result.district
						value: result.district
						record: result
					}]
					districtField.setValue(result.district)

			if _.isString result.placeType
				template.$('konecty-select[name=placeType]')[0].setValue(result.placeType)

			if _.isString result.postalCode
				template.$('konecty-text[name=postalCode]')[0].setValue(result.postalCode)

	"blur konecty-text[name=postalCode]": (e) ->
		postalCode = e.currentTarget.getValue()
		# 91330520
		if _.isEmpty postalCode
			return

		template = Template.instance()

		Meteor.call 'DNE_CEP_List', postalCode, (err, result) ->
			if not _.isArray(result) or result.length is 0
				return

			result = result[0]

			if result.state?
				stateField = template.$('konecty-select[name=state]')[0]
				if result.state isnt stateField.getValue()
					stateField.setValue result.state

			if result.city?
				cityField = template.$('konecty-select[name=city]')[0]
				if result.city isnt cityField.getValue()
					cityField.items = [{
						name: result.city
						value: result.city
						record: result
					}]
					cityField.setValue result.city

			if result.district?
				districtField = template.$('konecty-select[name=district]')[0]
				if result.district isnt districtField.getValue()
					districtField.items = [{
						name: result.district
						value: result.district
						record: result
					}]
					districtField.setValue result.district

			if result.placeType?
				placeTypeField = template.$('konecty-select[name=placeType]')[0]
				if result.placeType isnt placeTypeField.getValue()
					placeTypeField.setValue result.placeType

			if result.place?
				placeField = template.$('konecty-select[name=place]')[0]
				if result.place isnt placeField.getValue()
					placeField.items = [{
						name: result.place
						value: result.place
						record: result
					}]
					placeField.setValue result.place

	'combochange konecty-select[name=city]': (e) ->
		me = this
		text = e.originalEvent.detail
		select = e.target
		template = Template.instance()

		state = template.$('konecty-select[name=state]')[0].getValue()
		city = text

		if not state?
			return

		Meteor.call 'DNE_City_List', state, city, (err, result) ->
			if err?
				return console.log err

			items = []
			for item in result
				items.push
					name: item.city
					value: item.city
					record: item

			select.items = items

	'combochange konecty-select[name=district]': (e) ->
		me = this
		text = e.originalEvent.detail
		select = e.target
		template = Template.instance()

		state = template.$('konecty-select[name=state]')[0].getValue()
		city = template.$('konecty-select[name=city]')[0].getValue()
		district = text

		if not city? or not state?
			return

		Meteor.call 'DNE_District_List', state, city, district, (err, result) ->
			if err?
				return console.log err

			items = []
			for item in result
				items.push
					name: item.district
					value: item.district
					record: item

			select.items = items

	'combochange konecty-select[name=place]': (e) ->
		me = this
		text = e.originalEvent.detail
		select = e.target
		template = Template.instance()

		state = template.$('konecty-select[name=state]')[0].getValue()
		city = template.$('konecty-select[name=city]')[0].getSelected()
		district = '*'
		place = text
		number = undefined
		limit = 10

		if city?.record?.city?
			city = city.record.city
		else
			city = '*'

		Meteor.call 'DNE_Place_List', state, city, district, place, number, limit, (err, result) ->
			if err?
				return console.log err

			items = []
			for item in result
				items.push
					name: item.place
					value: item.place
					record: item

			select.items = items


	'click konecty-button#validate-address': (e) ->
		template = Template.instance()

		placeTypeField = template.$('konecty-select[name=placeType]')[0]
		placeField = template.$('konecty-select[name=place]')[0]
		numberField = template.$('konecty-text[name=number]')[0]
		cityField = template.$('konecty-select[name=city]')[0]
		stateField = template.$('konecty-select[name=state]')[0]
		countryField = template.$('konecty-select[name=country]')[0]
		districtField = template.$('konecty-select[name=district]')[0]

		placeType = placeTypeField.getValue()
		place = placeField.getValue()
		number = numberField.getValue()
		city = cityField.getValue()
		state = stateField.getValue()
		country = countryField.getValue()

		address = "#{placeType} #{place} #{number}, #{city}, #{state}, #{country}"

		geocoder = new google.maps.Geocoder()
		geocoder.geocode {address: address}, (addresses) ->
			# if addresses.length < 1
				# return me.fireEvent('invalid');

			route = _.filter addresses[0].address_components, (item) ->
				return 'route' in item.types

			sublocality = _.filter addresses[0].address_components, (item) ->
				return 'sublocality' in item.types or 'neighborhood' in item.types

			streetNumber = _.filter addresses[0].address_components, (item) ->
				return 'street_number' in item.types

			valid = not _.isEmpty route

			if valid
				if route.length > 0
					placeTypes = _.map template.$('konecty-select[name=placeType]')[0].items, (item) ->
						return item.value

					routePlace = route[0].long_name
					routePlace = routePlace.replace new RegExp('^('+placeTypes.join('|')+')\\s'), ''
					if not placeField.getSelected()? and place isnt routePlace
						placeField.items = [{
							name: routePlace
							value: routePlace
						}]
						placeField.setValue routePlace

				if sublocality.length > 0 and not districtField.getSelected()? and district isnt sublocality[0].long_name
					districtField.items = [{
						name: sublocality[0].long_name
						value: sublocality[0].long_name
					}]
					districtField.setValue sublocality[0].long_name

				marker = template.$('google-map-marker')[0]
				marker.latitude = addresses[0].geometry.location.lat()
				marker.longitude = addresses[0].geometry.location.lng()

				map = template.$('google-map')[0]
				map.latitude = addresses[0].geometry.location.lat()
				map.longitude = addresses[0].geometry.location.lng()
				return
		# 		return me.fireEvent('valid');


		# 	if(reverification === true) {
		# 		var address = (new Ext.Template('{district}, {city}, {state}, {country}')).apply(values);

		# 		return geocoder.geocode({address: address}, function(districtAddresses) {
		# 			if(districtAddresses.length != 1) {
		# 				me.down('kgmappanel').setGeolocation(addresses[0].geometry.location, true);
		# 			} else {
		# 				me.down('kgmappanel').setGeolocation(districtAddresses[0].geometry.location, true);
		# 			}
		# 			Konecty.Notification.Warning({title: 'Posição no mapa imprecisa', text: 'Arraste o pino para o ponto correto', keep: 1000*20, autoHide: true});
		# 			return me.fireEvent('valid');
		# 		});
		# 	}

		# 	Ext.Ajax.request({
		# 		url: ['/rest/dne', encodeURIComponent(forcedaddressfield.fields.country.getValue()), encodeURIComponent(forcedaddressfield.fields.state.getValue()), encodeURIComponent(forcedaddressfield.fields.city.getValue()), '*', encodeURIComponent(forcedaddressfield.fields.place.getValue()), encodeURIComponent(forcedaddressfield.fields.number.getValue()), 'l:2'].join('/'),
		# 		success: function(r) {
		# 			var data = Ext.decode(r.responseText);
		# 			if(Ext.isEmpty(data) || data.length != 1 || forcedaddressfield.fields.place.getValue() !== data[0].place) {
		#				Konecty.Notification.Info({text: 'Rua invalida'});
		# 				return me.fireEvent('invalid');
		# 			}

		# 			data = Ext.Array.filter(data, function(item) {
		# 				return item.city === forcedaddressfield.fields.city.getValue() && item.place === forcedaddressfield.fields.place.getValue();;
		# 			});
		# 			data = data[0];

		# 			if(data.district && forcedaddressfield.fields.district.getValue() !== data.district) {
		# 				forcedaddressfield.fields.district.store.add(data);
		# 				forcedaddressfield.fields.district.setValue(data.district);
		# 			}

		# 			if(forcedaddressfield.fields.placeType.getValue() !== data.placeType) {
		# 				forcedaddressfield.fields.placeType.setValue(data.placeType);
		# 			}

		# 			if(data.postalCode && forcedaddressfield.fields.postalCode.getValue() !== data.postalCode) {
		# 				forcedaddressfield.fields.postalCode.setValue(data.postalCode);
		# 			}

		# 			me.validateAddress(cp, true);
		# 		},
		# 		failure: function() {
		# 			continueAddressValidation();
		# 		}
		# 	});
		# });