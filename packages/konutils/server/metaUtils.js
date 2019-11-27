import moment from 'moment';

import { createHash } from 'crypto';

import { isArray, isNumber, isObject, isString, isBoolean, has, get } from 'lodash';
metaUtils = {};

const NS_PER_SEC = 1e9;

metaUtils.validateAndProcessValueFor = function(
	meta,
	fieldName,
	value,
	actionType,
	model,
	objectOriginalValues,
	objectNewValues,
	idsToUpdate
) {
	let query;
	const field = meta.fields[fieldName];

	if (!field) {
		return new Meteor.Error('utils-internal-error', `Field ${fieldName} does not exists on ${meta._id}`);
	}

	// Validate required fields
	if (field.isRequired === true && !value) {
		return new Meteor.Error('utils-internal-error', `O Campo '${fieldName}' é obrigatório, mas não está presente no dado.`, {
			meta,
			fieldName,
			value,
			actionType,
			model,
			objectOriginalValues,
			objectNewValues,
			idsToUpdate
		});
	}

	// Validate List fields
	if (field.isList === true) {
		if (field.maxElements && field.maxElements > 0) {
			if (!isArray(value) || value.length > field.maxElements) {
				return new Meteor.Error(
					'utils-internal-error',
					`Value for field ${fieldName} must be array with the maximum of ${field.maxElements} item(s)`
				);
			}
		}

		if (field.minElements && field.minElements > 0) {
			if (!isArray(value) || value.length < field.minElements) {
				return new Meteor.Error(
					'utils-internal-error',
					`Value for field ${fieldName} must be array with at least ${field.minElements} item(s)`
				);
			}
		}

		if (field.isAllowDuplicates === false && isArray(value)) {
			for (let itemA of value) {
				for (let itemB of value) {
					if (utils.deepEqual(itemA, itemB) === true) {
						return new Meteor.Error(
							'utils-internal-error',
							`Value for field ${fieldName} must be array no duplicated values`
						);
					}
				}
			}
		}
	}

	// Validate picklist min selected
	if (field.type === 'picklist') {
		if (isNumber(field.minSelected)) {
			if (field.minSelected === 1) {
				if (!value || (isArray(value) && value.length === 0)) {
					return new Meteor.Error(
						'utils-internal-error',
						`A lista de escolha '${fieldName}' exige o mínimo de 1 valores selecionados. Mas não está presente no dado.`
					);
				}
			}
		}
	}

	if (actionType === 'update' && !value && field.type === 'lookup') {
		lookupUtils.removeInheritedFields(field, objectNewValues);
	}

	if (!value && field.type !== 'autoNumber') {
		return value;
	}

	// If field is Unique verify if exists another record on db with same value
	if (value && field.isUnique === true && field.type !== 'autoNumber') {
		query = {};
		query[fieldName] = value;

		const multiUpdate = (idsToUpdate != null ? idsToUpdate.length : undefined) > 1;

		// If is a single update exclude self record in verification
		if (actionType === 'update' && multiUpdate !== true) {
			query._id = { $ne: idsToUpdate[0] };
		}

		const count = model.find(query).count();
		if (count > 0) {
			return new Meteor.Error('utils-internal-error', `Value for field ${fieldName} must be unique`);
		}
	}

	let result = true;

	const removeUnauthorizedKeys = function(obj, keys, path) {
		const objKeys = Object.keys(obj);

		const unauthorizedKeys = objKeys.filter(key => keys.indexOf(key) === -1);

		for (let key of unauthorizedKeys) {
			delete obj[key];
		}

		return obj;
	};

	var mustBeValidFilter = function(v) {
		let condition;
		if (['and', 'or'].includes(!v.match)) {
			result = new Meteor.Error(
				'utils-internal-error',
				`Value for field ${fieldName} must contains a property named 'match' with one of values ['and', 'or']`
			);
			return false;
		}

		if (isArray(v.conditions)) {
			const objectOfConditions = {};
			for (condition of v.conditions) {
				objectOfConditions[condition.term.replace(/\./g, ':') + ':' + condition.operator] = condition;
			}
			v.conditions = objectOfConditions;
		}

		if (!isObject(v.conditions)) {
			result = new Meteor.Error(
				'utils-internal-error',
				`Value for field ${fieldName} must contains a property named 'conditions' of type Object with at least 1 item`
			);
			return false;
		}

		for (let key in v.conditions) {
			condition = v.conditions[key];
			if (mustBeString(condition.term) === false || mustBeString(condition.operator) === false) {
				result = new Meteor.Error(
					'utils-internal-error',
					`Value for field ${fieldName} must contains conditions with properties 'term' and 'operator' of type String`
				);
				return false;
			}

			const operators = [
				'exists',
				'equals',
				'not_equals',
				'in',
				'not_in',
				'contains',
				'not_contains',
				'starts_with',
				'end_with',
				'less_than',
				'greater_than',
				'less_or_equals',
				'greater_or_equals',
				'between'
			];

			if (operators.includes(!condition.operator)) {
				result = new Meteor.Error(
					'utils-internal-error',
					`Value for field ${fieldName} must contains conditions with valid operators such as [${operators.join(', ')}]`
				);
				return false;
			}

			if (!has(condition, 'value')) {
				result = new Meteor.Error(
					'utils-internal-error',
					`Value for field ${fieldName} must contains conditions property named 'value'`
				);
				return false;
			}
		}

		if (isArray(v.filters)) {
			for (let filter of v.filters) {
				if (mustBeValidFilter(filter) === false) {
					return false;
				}
			}
		}
	};

	var mustBeString = function(v, path) {
		if (!isString(v)) {
			result = new Meteor.Error('utils-internal-error', `Value for field ${path || fieldName} must be a valid String`);
			return false;
		}
	};

	const mustBeStringOrNull = function(v, path) {
		if (!v) {
			return true;
		}
		return mustBeString(v, path);
	};

	const mustBeNumber = function(v, path) {
		if (!isNumber(v)) {
			result = new Meteor.Error('utils-internal-error', `Value for field ${path || fieldName} must be a valid Number`);
			return false;
		}
	};

	const mustBeNumberOrNull = function(v, path) {
		if (!v) {
			return true;
		}
		return mustBeNumber(v, path);
	};

	const mustBeBoolean = function(v, path) {
		if (!isBoolean(v)) {
			result = new Meteor.Error('utils-internal-error', `Value for field ${path || fieldName} must be a valid Boolean`);
			return false;
		}
	};

	const mustBeBooleanOrNull = function(v, path) {
		if (!v) {
			return true;
		}
		return mustBeBoolean(v, path);
	};

	const mustBeObject = function(v, path) {
		if (!isObject(v)) {
			result = new Meteor.Error('utils-internal-error', `Value for field ${path || fieldName} must be a valid Object`);
			return false;
		}
	};

	const mustBeObjectOrNull = function(v, path) {
		if (!v) {
			return true;
		}
		return mustBeObject(v, path);
	};

	const mustBeArray = function(v, path) {
		if (!isArray(v)) {
			result = new Meteor.Error('utils-internal-error', `Value for field ${path || fieldName} must be a valid Array`);
			return false;
		}
	};

	const mustBeArrayOrNull = function(v, path) {
		if (!v) {
			return true;
		}
		return mustBeArray(v, path);
	};

	const mustBeDate = function(v, path) {
		const date = new Date(v);

		if (isNaN(date)) {
			result = new Meteor.Error(
				'utils-internal-error',
				`Value for field ${path || fieldName} must be a valid string or number representation of date`
			);
			return false;
		}
	};

	const mustBeDateOrNull = function(v, path) {
		if (!v) {
			return true;
		}
		return mustBeDate(v, path);
	};

	const validate = function(value) {
		let optionalKeys, requiredKeys;
		switch (field.type) {
			case 'boolean':
				if (mustBeBoolean(value) === false) {
					return result;
				}
				break;

			case 'number':
			case 'percentage':
				if (mustBeNumber(value) === false) {
					return result;
				}

				if (isNumber(field.maxValue) && value > field.maxValue) {
					return new Meteor.Error(
						'utils-internal-error',
						`Value for field ${fieldName} must be less than ${field.maxValue}`
					);
				}

				if (isNumber(field.minValue) && value < field.minValue) {
					return new Meteor.Error(
						'utils-internal-error',
						`Value for field ${fieldName} must be greater than ${field.minValue}`
					);
				}
				break;

			case 'picklist':
				if (isNumber(field.maxSelected) && field.maxSelected > 1) {
					if (mustBeArray(value) === false) {
						return result;
					}
					if (value.length > field.maxSelected) {
						return new Meteor.Error(
							'utils-internal-error',
							`Value for field ${fieldName} must be an array with max of ${field.maxSelected} item(s)`
						);
					}
				}

				if (isNumber(field.minSelected) && field.minSelected > 0) {
					if (value.length < field.minSelected) {
						return new Meteor.Error(
							'utils-internal-error',
							`Value for field ${fieldName} must be an array with min of ${field.minSelected} item(s)`
						);
					}
				}

				var valuesToVerify = [].concat(value);

				for (let valueToVerify of valuesToVerify) {
					if (!field.options[valueToVerify]) {
						return new Meteor.Error('utils-internal-error', `Value ${valueToVerify} for field ${fieldName} is invalid`);
					}
				}
				break;

			case 'text':
			case 'richText':
				if (isNumber(value)) {
					value = String(value);
				}

				if (mustBeString(value) === false) {
					return result;
				}

				if (!field.normalization && changeCase[`${field.normalization}Case`]) {
					value = changeCase[`${field.normalization}Case`](value);
				}

				if (isNumber(field.size) && field.size > 0) {
					if (value.length > field.size) {
						return new Meteor.Error(
							'utils-internal-error',
							`Value for field ${fieldName} must be smaller than ${field.size}`
						);
					}
				}
				break;

			case 'dateTime':
			case 'date':
				if (mustBeObject(value) === false) {
					return result;
				}

				if (mustBeDate(value.$date || value, `${fieldName}.$date`) === false) {
					return result;
				}

				value = new Date(value.$date || value);

				if (field.maxValue || field.minValue) {
					let momentFormat;
					let { maxValue } = field;
					let { minValue } = field;
					if (field.type === 'date') {
						value.setHours(0);
						value.setMinutes(0);
						value.setSeconds(0);
						value.setMilliseconds(0);
					}

					if (maxValue && maxValue === '$now') {
						maxValue = new Date();
						if (field.type === 'date') {
							maxValue.setHours(0);
							maxValue.setMinutes(0);
							maxValue.setSeconds(0);
							maxValue.setMilliseconds(0);
						}
					}

					if (minValue && minValue === '$now') {
						minValue = new Date();
						if (field.type === 'date') {
							minValue.setHours(0);
							minValue.setMinutes(0);
							minValue.setSeconds(0);
							minValue.setMilliseconds(0);
						}
					}

					if (field.type === 'date') {
						momentFormat = 'DD/MM/YYYY';
					} else {
						momentFormat = 'DD/MM/YYYY HH:mm:ss';
					}

					if (mustBeDate(maxValue) !== false && value > maxValue) {
						return new Meteor.Error(
							'utils-internal-error',
							`Value for field ${fieldName} must be less than or equals to ${moment(maxValue).format(momentFormat)}`
						);
					}

					if (mustBeDate(minValue) !== false && value < minValue) {
						return new Meteor.Error(
							'utils-internal-error',
							`Value for field ${fieldName} must be greater than or equals to ${moment(minValue).format(
								momentFormat
							)}`
						);
					}
				}
				break;
			case 'time':
				if (mustBeNumber(value) === false) {
					return result;
				}

				if (value < 0 || value > 86400000) {
					return new Meteor.Error(
						'utils-internal-error',
						`Value for field ${fieldName} must be agreater then 0 and less then 86400000`
					);
				}
				break;

			case 'email':
				if (mustBeObject(value) === false) {
					return result;
				}
				if (mustBeString(value.address) === false) {
					return result;
				}
				if (mustBeStringOrNull(value.type) === false) {
					return result;
				}

				if (regexUtils.email.test(value.address) === false) {
					return new Meteor.Error('utils-internal-error', `Value for field ${fieldName}.address must be a valid email`);
				}

				value.address = value.address.toLowerCase();
				break;

			case 'url':
				if (mustBeString(value) === false) {
					return result;
				}

				if (regexUtils.url.test(value) === false) {
					return new Meteor.Error('utils-internal-error', `Value for field ${fieldName} must be a valid url`);
				}
				break;

			case 'personName':
				if (mustBeObject(value) === false) {
					return result;
				}

				var keys = ['prefix', 'first', 'middle', 'last', 'sufix'];

				removeUnauthorizedKeys(value, keys);

				var fullName = [];
				for (var key of keys) {
					if (mustBeStringOrNull(value[key], `${fieldName}.${key}`) === false) {
						return result;
					}
					if (isString(value[key])) {
						value[key] = changeCase.titleCase(value[key]);
						fullName.push(value[key]);
					}
				}

				value.full = fullName.join(' ');
				break;

			case 'phone':
				if (mustBeObject(value) === false) {
					return result;
				}

				var validKeys = ['countryCode', 'phoneNumber', 'extention', 'type'];

				removeUnauthorizedKeys(value, validKeys);

				for (let validKey of validKeys) {
					if (isNumber(value[validKey])) {
						value[validKey] = String(value[validKey]);
					}
				}

				if (isString(value.countryCode)) {
					value.countryCode = parseInt(value.countryCode);
				}

				if (mustBeNumber(value.countryCode, `${fieldName}.countryCode`) === false) {
					return result;
				}
				if (mustBeString(value.phoneNumber, `${fieldName}.phoneNumber`) === false) {
					return result;
				}
				if (mustBeStringOrNull(value.extention, `${fieldName}.extention`) === false) {
					return result;
				}
				if (mustBeStringOrNull(value.extention, `${fieldName}.type`) === false) {
					return result;
				}

				if (value.countryCode < 0 || value.countryCode > 999) {
					return new Meteor.Error(
						'utils-internal-error',
						`Value for field ${fieldName}.countryCode must contains 1, 2 or 3 digits`
					);
				}

				if (value.countryCode === 55 && !/^[0-9]{10,12}$/.test(value.phoneNumber)) {
					return new Meteor.Error(
						'utils-internal-error',
						`Value for field ${fieldName}.phoneNumber with countryCode '55' must contains from 10 to 12 digits`
					);
				}
				break;

			case 'geoloc':
				if (mustBeArray(value) === false) {
					return result;
				}

				if (value.length !== 2 || !isNumber(value[0]) || !isNumber(value[1])) {
					return new Meteor.Error(
						'utils-internal-error',
						`Value for field ${fieldName} must be an array with longitude and latitude`
					);
				}
				break;

			case 'money':
				if (mustBeObject(value) === false) {
					return result;
				}

				removeUnauthorizedKeys(value, ['currency', 'value']);

				var currencies = ['BRL'];
				if (!isString(value.currency) || currencies.includes(!value.currency)) {
					return new Meteor.Error(
						'utils-internal-error',
						`Value for field ${fieldName}.currency must be one of [${currencies.join(', ')}]`
					);
				}

				if (!isNumber(value.value)) {
					return new Meteor.Error('utils-internal-error', `Value for field ${fieldName}.value must be a valid Number`);
				}
				break;

			case 'json':
				if (!isObject(value) && !isArray(value)) {
					return new Meteor.Error('utils-internal-error', `Value for field ${fieldName} must be a valid Array or Object`);
				}
				break;

			case 'password':
				if (mustBeString(value) === false) {
					return result;
				}

				value = password.encrypt(value);
				break;

			case 'encrypted':
				if (mustBeString(value) === false) {
					return result;
				}

				value = createHash('md5')
					.update(value)
					.digest('hex');
				break;

			case 'autoNumber':
				if (actionType === 'update') {
					value = undefined;
				} else {
					value = metaUtils.getNextCode(meta.name, fieldName);
				}
				break;

			case 'address':
				if (mustBeObject(value) === false) {
					return result;
				}

				if (field.isRequired === true) {
					requiredKeys = ['country', 'state', 'city', 'place', 'number'];
					optionalKeys = ['postalCode', 'district', 'placeType', 'complement', 'type'];
				} else {
					requiredKeys = [];
					optionalKeys = [
						'country',
						'state',
						'city',
						'place',
						'number',
						'postalCode',
						'district',
						'placeType',
						'complement',
						'type'
					];
				}

				var extraKeys = ['geolocation'];

				removeUnauthorizedKeys(value, requiredKeys.concat(optionalKeys).concat(extraKeys));

				for (key of requiredKeys) {
					if (isNumber(value[key])) {
						value[key] = String(value[key]);
					}

					if (mustBeString(value[key], `${fieldName}.${key}`) === false) {
						return result;
					}
				}

				for (key of optionalKeys) {
					if (isNumber(value[key])) {
						value[key] = String(value[key]);
					}

					if (mustBeStringOrNull(value[key], `${fieldName}.${key}`) === false) {
						return result;
					}
				}

				if (mustBeArrayOrNull(value.geolocation, `${fieldName}.geolocation`) === false) {
					return result;
				}

				if (
					isArray(value.geolocation) &&
					(value.geolocation.length !== 2 || !isNumber(value.geolocation[0]) || !isNumber(value.geolocation[1]))
				) {
					return new Meteor.Error(
						'utils-internal-error',
						`Value for field ${fieldName}.geolocation must be an array with longitude and latitude`
					);
				}
				break;

			case 'filter':
				if (mustBeObject(value) === false) {
					return result;
				}

				if (mustBeValidFilter(value) === false) {
					return result;
				}

				utils.recursiveObject(value, function(key, value, parent) {
					if (value ? value['$date'] : undefined) {
						return (parent[key] = new Date(value['$date']));
					}
				});
				break;

			case 'composite':
				if (mustBeObject(value) === false) {
					return result;
				}

				if (field.compositeType === 'reference') {
					meta = Meta[field.objectRefId];
					if (!meta) {
						return new Meteor.Error('utils-internal-error', `Document ${field.objectRefId} not found`);
					}

					for (key in value) {
						const subValue = value[key];
						const validation = metaUtils.validateAndProcessValueFor(
							meta,
							key,
							subValue,
							actionType,
							model,
							value,
							value,
							idsToUpdate
						);
						if (validation instanceof Error) {
							return validation;
						}
						value[key] = validation;
					}
				}
				break;

			case 'lookup':
			case 'inheritLookup':
				if (mustBeObject(value) === false) {
					return result;
				}

				if (mustBeString(value._id, `${fieldName}._id`) === false) {
					return result;
				}

				var lookupModel = Models[field.document];
				if (!lookupModel) {
					return new Meteor.Error('utils-internal-error', `Document ${field.document} not found`);
				}

				query = { _id: value._id };

				var record = lookupModel.findOne(query);

				if (!record) {
					return new Meteor.Error(
						'utils-internal-error',
						`Record not found for field ${fieldName} with _id [${value._id}] on document [${field.document}]`
					);
				}

				lookupUtils.copyDescriptionAndInheritedFields(
					field,
					value,
					record,
					meta,
					actionType,
					model,
					objectOriginalValues,
					objectNewValues,
					idsToUpdate
				);
				break;

			// when 'masked'
			// when 'calculated'
			case 'file':
				if (mustBeObject(value) === false) {
					return result;
				}
				keys = [
					'key',
					'name',
					'size',
					'created',
					'etag',
					'headers',
					'kind',
					'last_modified',
					'description',
					'label',
					'wildcard'
				];
				removeUnauthorizedKeys(value, keys);
				break;

			default:
				var e = new Meteor.Error('utils-internal-error', `Field ${fieldName} of type ${field.type} can not be validated`);
				NotifyErrors.notify('ValidateError', e);
				return e;
		}

		return value;
	};

	if (field.isList !== true) {
		return validate(value);
	}

	if (!isArray(value)) {
		if (value) {
			value = [value];
		} else {
			return new Meteor.Error('utils-internal-error', `Value for field ${fieldName} must be array`);
		}
	}

	for (let index = 0; index < value.length; index++) {
		const item = value[index];
		value[index] = validate(item);
		if (value[index] instanceof Error) {
			return value[index];
		}
	}

	return value;
};

metaUtils.getNextUserFromQueue = function(queueStrId, user) {
	const collection = Models.QueueUser.rawCollection();
	const findOneAndUpdate = Meteor.wrapAsync(collection.findOneAndUpdate, collection);

	// Mount query, sort, update, and options
	const query = { 'queue._id': queueStrId };

	const sort = {
		count: 1,
		order: 1
	};

	const update = {
		$inc: {
			count: 1
		},
		$set: {
			_updatedAt: new Date(),
			_updatedBy: {
				_id: user._id,
				name: user.name,
				group: user.group
			}
		}
	};

	const options = {
		new: true,
		sort: sort
	};

	// Execute findOneAndUpdate
	let queueUser = findOneAndUpdate(query, update, options);

	if (queueUser && queueUser.value) {
		queueUser = queueUser.value;
	} else {
		queueUser = undefined;
	}

	if (!isObject(queueUser)) {
		queueUser = Models.Queue.findOne(queueStrId);
		if (has(queueUser, '_user.0')) {
			return {
				user: queueUser._user[0]
			};
		}
		return undefined;
	}

	// ConvertIds
	utils.convertObjectIdsToFn(queueUser, id => id.valueOf());

	// Return queueUser
	return queueUser;
};

metaUtils.getNextCode = function(documentName, fieldName) {
	if (!fieldName) {
		fieldName = 'code';
	}

	const collection = Models[`${documentName}.AutoNumber`].rawCollection();
	const findOneAndUpdate = Meteor.wrapAsync(collection.findOneAndUpdate, collection);
	const destCollection = Models[documentName].rawCollection();
	const findOne = Meteor.wrapAsync(destCollection.findOne, destCollection);

	// Mount query, sort, update, and options
	const query = { _id: fieldName };

	const update = {
		$inc: {
			next_val: 1
		}
	};

	const options = {
		upsert: true,
		returnOriginal: false
	};

	// Try to get next code
	try {
		const startTime = process.hrtime();
		const elapsedTimeInSeconds = time => {
			const [sec, nanosec] = process.hrtime(startTime);
			return sec + Math.ceil(nanosec / NS_PER_SEC);
		};
		while (elapsedTimeInSeconds(startTime) < 10) {
			const result = findOneAndUpdate(query, update, options);
			const next_val = get(result, 'value.next_val', 1);

			// Validate the new sequential
			const maxRes = findOne(
				{ [fieldName]: next_val },
				{
					fields: {
						_id: false,
						code: true
					}
				}
			);
			if (maxRes == null) {
				return next_val;
			}
			console.log(`Duplicated key found on ${documentName}.${fieldName}: ${next_val}`);
		}
		throw new Error(`Error creating new ${fieldName} value from ${documentName}: Timeout exceed!`);
	} catch (e) {
		throw e;
	}
};

/* Populate passed data with more lookup information
	@param {String} documentName
	@param {Object} data
	@param {Object} fields  An Object with names of fields to populate with witch fields to populate

	@example
		metaUtils.populateLookupsData('Recruitment', record, {job: {code: 1}, contact: {code: 1, name: 1}})
*/
metaUtils.populateLookupsData = function(documentName, data, fields) {
	check(fields, Object);

	const meta = Meta[documentName];

	for (let fieldName in meta.fields) {
		const field = meta.fields[fieldName];
		if (field.type === 'lookup' && data[fieldName] && fields[fieldName]) {
			const options = {};
			if (Match.test(fields[fieldName], Object)) {
				options.fields = fields[fieldName];
			}

			if (field.isList !== true) {
				data[fieldName] = Models[field.document].findOne({ _id: data[fieldName]._id }, options);
			} else {
				const ids = get(data, fieldName, []).map(item => item._id);

				if (ids.length > 0) {
					data[fieldName] = Models[field.document].find({ _id: { $in: ids } }, options).fetch();
				}
			}
		}
	}

	return data;
};
