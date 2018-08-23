/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.modalAddress.events({
	"enter konecty-select"(e) {
		return __guard__($(e.currentTarget).next(), x => x.focus());
	},

	"enter konecty-text"(e) {
		return __guard__($(e.currentTarget).next(), x => x.focus());
	},

	"click konecty-button.action"() {
		return alert("Action");
	},

	"click konecty-button.close"() {
		return Modal.close();
	},

	"change konecty-select[name=country]"(e) {
		return console.log(e.currentTarget.value);
	},

	"change konecty-select[name=state]"(e) {
		return console.log(e.currentTarget.value);
	},

	"change konecty-select[name=city]"(e) {
		return console.log(e.currentTarget.getSelected());
	},

	"change konecty-select[name=district]"(e) {
		return console.log(e.currentTarget.getSelected());
	},

	"change konecty-select[name=place]"(e) {
		const selection = e.currentTarget.getSelected();
		if ((selection != null ? selection.record : undefined) != null) {
			const template = Template.instance();

			if (_.isString(selection.record.district)) {
				const districtField = template.$('konecty-select[name=district]')[0];
				if (selection.record.district !== districtField.getValue()) {
					districtField.items = [{
						name: selection.record.district,
						value: selection.record.district,
						record: selection.record
					}];
					districtField.setValue(selection.record.district);
				}
			}

			if (_.isString(selection.record.placeType)) {
				template.$('konecty-select[name=placeType]')[0].setValue(selection.record.placeType);
			}

			if (_.isString(selection.record.postalCode)) {
				return template.$('konecty-text[name=postalCode]')[0].setValue(selection.record.postalCode);
			}
		}
	},

	"blur konecty-text[name=number]"(e) {
		const number = parseInt(e.currentTarget.getValue());
		if (_.isBlank(number)) {
			return;
		}

		const template = Template.instance();

		const postalCode = template.$('konecty-text[name=postalCode]')[0].getValue();

		if (!_.isBlank(postalCode)) {
			return;
		}

		const state = template.$('konecty-select[name=state]')[0].getValue();
		let city = template.$('konecty-select[name=city]')[0].getValue();
		const district = '*';
		const place = template.$('konecty-select[name=place]')[0].getValue();
		const limit = 2;

		if (_.isBlank(city)) {
			city = '*';
		}

		return Meteor.call('DNE_Place_List', state, city, district, place, number, limit, function(err, result) {
			if (err != null) {
				return console.log(err);
			}

			if (_.isEmpty(result) || !_.isArray(result) || (result.length === 0)) {
				return;
			}

			result = result.filter(item => (item.place === place) && (item.city === city));

			if (result.length === 0) {
				return;
			}

			result = result[0];

			if (_.isString(result.district)) {
				const districtField = template.$('konecty-select[name=district]')[0];
				if (result.district !== districtField.getValue()) {
					districtField.items = [{
						name: result.district,
						value: result.district,
						record: result
					}];
					districtField.setValue(result.district);
				}
			}

			if (_.isString(result.placeType)) {
				template.$('konecty-select[name=placeType]')[0].setValue(result.placeType);
			}

			if (_.isString(result.postalCode)) {
				return template.$('konecty-text[name=postalCode]')[0].setValue(result.postalCode);
			}
		});
	},

	"blur konecty-text[name=postalCode]"(e) {
		const postalCode = e.currentTarget.getValue();
		// 91330520
		if (_.isEmpty(postalCode)) {
			return;
		}

		const template = Template.instance();

		return Meteor.call('DNE_CEP_List', postalCode, function(err, result) {
			if (!_.isArray(result) || (result.length === 0)) {
				return;
			}

			result = result[0];

			if (result.state != null) {
				const stateField = template.$('konecty-select[name=state]')[0];
				if (result.state !== stateField.getValue()) {
					stateField.setValue(result.state);
				}
			}

			if (result.city != null) {
				const cityField = template.$('konecty-select[name=city]')[0];
				if (result.city !== cityField.getValue()) {
					cityField.items = [{
						name: result.city,
						value: result.city,
						record: result
					}];
					cityField.setValue(result.city);
				}
			}

			if (result.district != null) {
				const districtField = template.$('konecty-select[name=district]')[0];
				if (result.district !== districtField.getValue()) {
					districtField.items = [{
						name: result.district,
						value: result.district,
						record: result
					}];
					districtField.setValue(result.district);
				}
			}

			if (result.placeType != null) {
				const placeTypeField = template.$('konecty-select[name=placeType]')[0];
				if (result.placeType !== placeTypeField.getValue()) {
					placeTypeField.setValue(result.placeType);
				}
			}

			if (result.place != null) {
				const placeField = template.$('konecty-select[name=place]')[0];
				if (result.place !== placeField.getValue()) {
					placeField.items = [{
						name: result.place,
						value: result.place,
						record: result
					}];
					return placeField.setValue(result.place);
				}
			}
		});
	},

	'combochange konecty-select[name=city]'(e) {
		const me = this;
		const text = e.originalEvent.detail;
		const select = e.target;
		const template = Template.instance();

		const state = template.$('konecty-select[name=state]')[0].getValue();
		const city = text;

		if ((state == null)) {
			return;
		}

		return Meteor.call('DNE_City_List', state, city, function(err, result) {
			if (err != null) {
				return console.log(err);
			}

			const items = [];
			for (let item of Array.from(result)) {
				items.push({
					name: item.city,
					value: item.city,
					record: item
				});
			}

			return select.items = items;
		});
	},

	'combochange konecty-select[name=district]'(e) {
		const me = this;
		const text = e.originalEvent.detail;
		const select = e.target;
		const template = Template.instance();

		const state = template.$('konecty-select[name=state]')[0].getValue();
		const city = template.$('konecty-select[name=city]')[0].getValue();
		const district = text;

		if ((city == null) || (state == null)) {
			return;
		}

		return Meteor.call('DNE_District_List', state, city, district, function(err, result) {
			if (err != null) {
				return console.log(err);
			}

			const items = [];
			for (let item of Array.from(result)) {
				items.push({
					name: item.district,
					value: item.district,
					record: item
				});
			}

			return select.items = items;
		});
	},

	'combochange konecty-select[name=place]'(e) {
		const me = this;
		const text = e.originalEvent.detail;
		const select = e.target;
		const template = Template.instance();

		const state = template.$('konecty-select[name=state]')[0].getValue();
		let city = template.$('konecty-select[name=city]')[0].getSelected();
		const district = '*';
		const place = text;
		const number = undefined;
		const limit = 10;

		if (__guard__(city != null ? city.record : undefined, x => x.city) != null) {
			({ city } = city.record);
		} else {
			city = '*';
		}

		return Meteor.call('DNE_Place_List', state, city, district, place, number, limit, function(err, result) {
			if (err != null) {
				return console.log(err);
			}

			const items = [];
			for (let item of Array.from(result)) {
				items.push({
					name: item.place,
					value: item.place,
					record: item
				});
			}

			return select.items = items;
		});
	},


	'click konecty-button#validate-address'(e) {
		const template = Template.instance();

		const placeTypeField = template.$('konecty-select[name=placeType]')[0];
		const placeField = template.$('konecty-select[name=place]')[0];
		const numberField = template.$('konecty-text[name=number]')[0];
		const cityField = template.$('konecty-select[name=city]')[0];
		const stateField = template.$('konecty-select[name=state]')[0];
		const countryField = template.$('konecty-select[name=country]')[0];
		const districtField = template.$('konecty-select[name=district]')[0];

		const placeType = placeTypeField.getValue();
		const place = placeField.getValue();
		const number = numberField.getValue();
		const city = cityField.getValue();
		const state = stateField.getValue();
		const country = countryField.getValue();

		const address = `${placeType} ${place} ${number}, ${city}, ${state}, ${country}`;

		const geocoder = new google.maps.Geocoder();
		return geocoder.geocode({address}, function(addresses) {
			// if addresses.length < 1
				// return me.fireEvent('invalid');

			const route = _.filter(addresses[0].address_components, item => Array.from(item.types).includes('route'));

			const sublocality = _.filter(addresses[0].address_components, item => Array.from(item.types).includes('sublocality') || Array.from(item.types).includes('neighborhood'));

			const streetNumber = _.filter(addresses[0].address_components, item => Array.from(item.types).includes('street_number'));

			const valid = !_.isEmpty(route);

			if (valid) {
				if (route.length > 0) {
					const placeTypes = _.map(template.$('konecty-select[name=placeType]')[0].items, item => item.value);

					let routePlace = route[0].long_name;
					routePlace = routePlace.replace(new RegExp(`^(${placeTypes.join('|')})\\s`), '');
					if ((placeField.getSelected() == null) && (place !== routePlace)) {
						placeField.items = [{
							name: routePlace,
							value: routePlace
						}];
						placeField.setValue(routePlace);
					}
				}

				if ((sublocality.length > 0) && (districtField.getSelected() == null) && (district !== sublocality[0].long_name)) {
					districtField.items = [{
						name: sublocality[0].long_name,
						value: sublocality[0].long_name
					}];
					districtField.setValue(sublocality[0].long_name);
				}

				const marker = template.$('google-map-marker')[0];
				marker.latitude = addresses[0].geometry.location.lat();
				marker.longitude = addresses[0].geometry.location.lng();

				const map = template.$('google-map')[0];
				map.latitude = addresses[0].geometry.location.lat();
				map.longitude = addresses[0].geometry.location.lng();
				return;
			}
		});
	}
});
		// 		return me.fireEvent('valid');


		// 	if(reverification === true) {
		// 		var address = (new Ext.Template('{district}, {city}, {state}, {country}')).apply(values);

		// 		return geocoder.geocode({address: address}, function(districtAddresses) {
		// 			if(districtAddresses.length != 1) {
		// 				me.down('kgmappanel').setGeolocation(addresses[0].geometry.location, true);
		// 			} else {
		// 				me.down('kgmappanel').setGeolocation(districtAddresses[0].geometry.location, true);
		// 			}
		// 			Konecty.Notification.Warning({title: 'Posição no mapa imprecisa', text: 'Arraste o pino para o ponto correto', keep: 1000*20, autoHide: true});
		// 			return me.fireEvent('valid');
		// 		});
		// 	}

		// 	Ext.Ajax.request({
		// 		url: ['/rest/dne', encodeURIComponent(forcedaddressfield.fields.country.getValue()), encodeURIComponent(forcedaddressfield.fields.state.getValue()), encodeURIComponent(forcedaddressfield.fields.city.getValue()), '*', encodeURIComponent(forcedaddressfield.fields.place.getValue()), encodeURIComponent(forcedaddressfield.fields.number.getValue()), 'l:2'].join('/'),
		// 		success: function(r) {
		// 			var data = Ext.decode(r.responseText);
		// 			if(Ext.isEmpty(data) || data.length != 1 || forcedaddressfield.fields.place.getValue() !== data[0].place) {
		//				Konecty.Notification.Info({text: 'Rua invalida'});
		// 				return me.fireEvent('invalid');
		// 			}

		// 			data = Ext.Array.filter(data, function(item) {
		// 				return item.city === forcedaddressfield.fields.city.getValue() && item.place === forcedaddressfield.fields.place.getValue();;
		// 			});
		// 			data = data[0];

		// 			if(data.district && forcedaddressfield.fields.district.getValue() !== data.district) {
		// 				forcedaddressfield.fields.district.store.add(data);
		// 				forcedaddressfield.fields.district.setValue(data.district);
		// 			}

		// 			if(forcedaddressfield.fields.placeType.getValue() !== data.placeType) {
		// 				forcedaddressfield.fields.placeType.setValue(data.placeType);
		// 			}

		// 			if(data.postalCode && forcedaddressfield.fields.postalCode.getValue() !== data.postalCode) {
		// 				forcedaddressfield.fields.postalCode.setValue(data.postalCode);
		// 			}

		// 			me.validateAddress(cp, true);
		// 		},
		// 		failure: function() {
		// 			continueAddressValidation();
		// 		}
		// 	});
		// });
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}