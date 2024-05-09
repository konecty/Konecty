import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import each from 'lodash/each';
import get from 'lodash/get';
import has from 'lodash/has';

import { MetaObject } from '@imports/model/MetaObject';

export function getTermsOfFilter(filter) {
	let condition;
	let terms = [];
	if (!isObject(filter)) {
		return terms;
	}

	if (isArray(filter.conditions)) {
		for (condition of filter.conditions) {
			terms.push(condition.term);
		}
	} else if (isObject(filter.conditions)) {
		for (let key in filter.conditions) {
			condition = filter.conditions[key];
			terms.push(condition.term);
		}
	}

	if (isArray(filter.filters)) {
		for (let i of filter.filters) {
			terms = terms.concat(getTermsOfFilter(i));
		}
	}

	return terms;
}

export function getFirstPartOfArrayOfPaths(paths) {
	if (!isArray(paths)) {
		return paths;
	}

	return paths.map(i => i.split('.')[0]);
}

export function formatValue(value, field, ignoreIsList) {
	if (!value) {
		return '';
	}

	if (field.isList === true && ignoreIsList !== true) {
		const values = [];
		for (let item of value) {
			values.push(formatValue(item, field, true));
		}
		return values.join(', ');
	}

	switch (field.type) {
		// TODO time

		case 'boolean':
			if (value === true) {
				return 'Sim';
			} else {
				return 'Não';
			}
		case 'personName':
			return value.full;
		case 'lookup':
			var result = [];

			var recursive = function (field, value) {
				if (field.type === 'lookup') {
					const meta = MetaObject.Meta[field.document];
					const recursiveValues = [];

					each(field.descriptionFields, function (descriptionField) {
						descriptionField = descriptionField.split('.');

						descriptionField = meta.fields[descriptionField[0]];

						if (descriptionField && isObject(value)) {
							return recursiveValues.push(recursive(descriptionField, value[descriptionField.name]));
						}
					});

					return recursiveValues;
				}

				value = formatValue(value, field);
				return value;
			};

			result = recursive(field, value);

			var sort = items => items.sort(a => isArray(a));

			var resultRecursive = function (items) {
				if (isArray(items)) {
					items = sort(items);
					each(items, (item, index) => (items[index] = resultRecursive(item)));

					return `(${items.join(' - ')})`;
				}

				return items;
			};

			result = sort(result);
			each(result, (r, index) => (result[index] = resultRecursive(r)));

			return result.join(' - ');
		case 'address':
			result = [];
			value.placeType && result.push(`${value.placeType}`);
			value.place && result.push(` ${value.place}`);
			value.number && result.push(`, ${value.number}`);
			value.complement && result.push(`, ${value.complement}`);
			value.district && result.push(`, ${value.district}`);
			value.city && result.push(`, ${value.city}`);
			value.state && result.push(`, ${value.state}`);
			value.country && result.push(`, ${value.country}`);
			value.postalCode && result.push(`, ${value.postalCode}`);
			return result.join('');
		case 'phone':
			result = [];
			value.countryCode && result.push(`${value.countryCode}`);
			value.phoneNumber &&
				value.phoneNumber.length > 6 &&
				result.push(` (${value.phoneNumber.substr(0, 2)}) ${value.phoneNumber.substr(2, 4)}-${value.phoneNumber.substr(6)}`);
			return result.join('');
		case 'money':
			result = [];
			if (get(value, 'currency') === 'BRL') {
				return `R$ ${numberFormat(value.value, 2, ',', '.')}`;
			} else {
				return `$ ${numberFormat(value.value, 2)}`;
			}
		case 'date':
			if (value.toISOString != null) {
				return value.toISOString().replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$3/$2/$1');
			} else {
				return value;
			}
		case 'dateTime':
			if (value.toISOString != null) {
				return value.toISOString().replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).*/, '$3/$2/$1 $4:$5:$6');
			} else {
				return value;
			}
		case 'filter':
			return '(filtro)';
		case 'picklist':
			if (isArray(value)) {
				return value.join(', ');
			} else {
				return value;
			}
		default:
			return value;
	}
}

export function numberFormat(number, dec, dsep, tsep) {
	if (isNaN(number) || number == null) return '';

	number = number.toFixed(~~dec);
	tsep = typeof tsep == 'string' ? tsep : ',';

	var parts = number.split('.'),
		fnums = parts[0],
		decimals = parts[1] ? (dsep || '.') + parts[1] : '';

	return fnums.replace(/(\d)(?=(?:\d{3})+$)/g, '$1' + tsep) + decimals;
}

export function getByLocale(obj, user) {
	if (!has(user, 'locale') || !has(obj, user.locale)) {
		return;
	}

	return obj[user.locale];
}

export function getLabel(obj, user) {
	if (!has(obj, 'label')) {
		return;
	}

	return getByLocale(obj.label, user);
}

export function getPlurals(obj, user) {
	if (!has(obj, 'plurals')) {
		return;
	}

	return getByLocale(obj.plurals, user);
}
