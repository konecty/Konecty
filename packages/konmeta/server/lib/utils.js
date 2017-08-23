export function convertObjectIdsToFn(values, fn) {
	if (_.isArray(values)) {
		values.forEach((item, index) => values[index] = convertObjectIdsToFn(item, fn));
		return values;
	}

	if (_.isObject(values)) {
		if (values instanceof Meteor.Collection.ObjectID) {
			return fn(values._str);
		}

		_.each(values, (value, key) => values[key] = convertObjectIdsToFn(value, fn));
		return values;
	}

	return values;
};

//obj_1, [obj_2], [obj_N]
export function DeepExtend() {
	if ((arguments.length < 1) || (typeof arguments[0] !== 'object')) {
		return false;
	}

	if (arguments.length < 2) {
		return arguments[0];
	}

	const target = arguments[0];

	// // convert arguments to array and cut off target object
	const args = Array.prototype.slice.call(arguments, 1);

	// var key, val, src, clone, tmpBuf;

	args.forEach(function(obj) {
		if (typeof obj !== 'object') {
			return;
		}

		return (() => {
			const result = [];
			for (let key in obj) {
				var clone;
				const val = obj[key];
				const src = target[key];

				if (val === target) {
					continue;
				}

				if (typeof val !== 'object') {
					target[key] = val;
					continue;
				} else if (val === null) {
					delete target[key];
					continue;
				} else if (val instanceof Buffer) {
					const tmpBuf = new Buffer(val.length);
					val.copy(tmpBuf);
					target[key] = tmpBuf;
					continue;
				} else if (val instanceof Date) {
					target[key] = new Date(val.getTime());
					continue;
				} else if (val instanceof RegExp) {
					target[key] = new RegExp(val);
					continue;
				}

				if ((typeof src !== 'object') || (src === null)) {
					clone = Array.isArray(val) ? [] : {};
					target[key] = DeepExtend(clone, val);
					continue;
				}

				if (Array.isArray(val)) {
					clone = Array.isArray(src) ? src : [];
				} else {
					clone = !Array.isArray(src) ? src : {};
				}

				result.push(target[key] = DeepExtend(clone, val));
			}
			return result;
		})();
	});

	return target;
};
