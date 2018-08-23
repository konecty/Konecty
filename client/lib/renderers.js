/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import moment from 'moment';

this.renderers = {
	render(value, field) {
		if ((renderers[field.type] == null)) {
			console.log(`Renderer for type [${type}] not found`);
			return value;
		}

		if (field.isList === true) {
			if (_.isArray(value)) {
				return (Array.from(value).map((item) => renderers[field.type](item, field)));
			} else {
				return [];
			}
		}

		return renderers[field.type](value, field);
	},

	list(value, field) {
		if (_.isArray(value) && (value.length > 0)) {
			return renderers[field.type](value[0], field);
		}
		return '';
	},

	boolean(value, field) {
		if (value != null) {
			if (value === true) { return 'Sim'; } else { return 'Não'; }
		}
	},

	autoNumber(value, field) {
		return value;
	},

	email(value, field) {
		if (value != null) {
			return `<a href=\"mailto:${value.address}\">${value.address}</a>`;
		}
	},

	text(value, field) {
		return value;
	},

	richText(value, field) {
		return '<div class="cell-detail"><i class="fa fa-eye"></i></div>';
	},

	json(value, field) {
		return '<div class="cell-detail"><i class="fa fa-eye"></i></div>';
	},

	filter(value, field) {
		return '<div class="cell-detail"><i class="fa fa-eye"></i></div>';
	},

	composite(value, field) {
		return '<div class="cell-detail"><i class="fa fa-eye"></i></div>';
	},

	url(value, field) {
		if (value != null) {
			return `<a href=\"${value}\">${value}</a>`;
		}
		return '';
	},

	personName(value, field) {
		return (value != null ? value.full : undefined);
	},

	phone(value, field) {
		if (value != null) {
			const phoneNumber = String(value.phoneNumber).replace(/(\d{2})(\d{4})(.+)/, '($1) $2-$3');
			return `<a href=\"callto:+${value.countryCode}${value.phoneNumber}\">+${value.countryCode}&nbsp;${phoneNumber}</a>`;
		}
	},

	dateTime(value, field) {
		if (value != null) {
			return moment(value).format('L LT');
		}
	},

	date(value, field) {
		if (value != null) {
			return moment(value).format('L');
		}
	},

	time(value, field) {
		if (value != null) {
			return moment().startOf('day').add(value).format('LT');
		}
	},

	money(value, field) {
		if (__guard__(value != null ? value.value : undefined, x => x.toFixed) != null) {
			let formatedValue = value.value.toFixed(2).replace('.', ',');
			while (/\d{4}[.,]/.test(formatedValue)) {
				formatedValue = formatedValue.replace(/(\d{1,})(\d{3})([,.])/, '$1.$2$3');
			}
			return `R$ ${formatedValue}`;
		}
		return value;
	},

	number(value, field) {
		if ((value != null ? value.toFixed : undefined) != null) {
			const fixed = (field.decimalSize != null) ? field.decimalSize : 0;
			let formatedValue = value.toFixed(fixed).replace('.', ',');
			while (/\d{6}[.,]/.test(formatedValue)) {
				formatedValue = formatedValue.replace(/(\d{3})(\d{3})([,.]|$)/, '$1.$2$3');
			}
			return formatedValue;
		}
	},

	percentage(value, field) {
		if ((value != null ? value.toFixed : undefined) != null) {
			const fixed = (field.decimalSize != null) ? field.decimalSize : 0;
			value = value * 100;
			let formatedValue = value.toFixed(fixed).replace('.', ',');
			while (/\d{6}[.,]/.test(formatedValue)) {
				formatedValue = formatedValue.replace(/(\d{3})(\d{3})([,.]|$)/, '$1.$2$3');
			}
			return formatedValue + '%';
		}
	},

	picklist(value, field) {
		if (field.maxSelected > 1) {
			if (_.isArray(value)) {
				const values = [];
				for (let item of Array.from(value)) {
					values.push(Blaze._globalHelpers.i18n(field.options[item]));
				}
				return values.join(', ');
			}
		} else {
			return Blaze._globalHelpers.i18n(field.options[value]);
		}
		return value;
	},

	address(value, field) {
		if (!_.isObject(value)) {
			return value;
		}

		const fields = ['place', 'number', 'complement', 'district', 'city', 'state', 'country', 'postalCode'];
		const countries =
			{BRA: 'Brasil'};
		let values = [];

		for (field of Array.from(fields)) {
			if (value[field] != null) {
				if (field === 'country') {
					value[field] = countries[value[field]];
				}

				values.push(value[field]);
			}
		}

		values = values.join(', ');

		if (value.placeType != null) {
			values = value.placeType + ' ' + values;
		}

		return values;
	},

	lookup(value, field) {
		if (!_.isObject(value)) {
			return '';
		}

		const lookupDocument = Menu.findOne({name: field.document, type: 'document'});

		let results = [];
		for (let key of Array.from(field.descriptionFields)) {
			const descriptionField = lookupDocument.fields[key.split('.')[0]];
			if ((descriptionField == null)) {
				console.error(`Description field [${key}] dos not exists in meta [${field.document}]`);
				continue;
			}
			results.push(renderers.render(value[descriptionField.name], descriptionField));
		}

		var recursive = function(values) {
			if (!_.isArray(values)) {
				return values;
			}

			values.sort((a, b) => _.isArray(a));

			for (value of Array.from(values)) {
				if (_.isArray(value)) {
					value = `(${recursive(value)}`;
				}
			}

			return values.join(' - ');
		};

		results = recursive(results);

		return results;
	}
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}