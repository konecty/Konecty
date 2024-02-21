import isDate from 'lodash/isDate';
import isPlainObject from 'lodash/isPlainObject';

export default function objectsDiff(object1: Record<string, any>, object2: Record<string, any>): Record<string, any> {
	let diff: Record<string, any> = {};

	Object.keys(object1).forEach(key => {
		if (object2.hasOwnProperty(key)) {
			// Arrays
			if (Array.isArray(object1[key]) && Array.isArray(object2[key])) {
				if (!arraysEqual(object1[key], object2[key])) {
					diff[key] = object2[key];
				}

				// Objects
			} else if (isPlainObject(object1[key]) && isPlainObject(object2[key])) {
				let result = objectsDiff(object1[key], object2[key]);
				if (Object.keys(result).length > 0) {
					diff[key] = result;
				}

				// Dates
			} else if (isDate(object1[key]) && isDate(object2[key])) {
				if (object1[key].getTime() !== object2[key].getTime()) {
					diff[key] = object2[key];
				}

				// Other
			} else if (object1[key] !== object2[key]) {
				diff[key] = object2[key];
			}
		} else {
			diff[key] = object1[key];
		}
	});

	Object.keys(object2).forEach(key => {
		if (!object1.hasOwnProperty(key)) {
			diff[key] = object2[key];
		}
	});

	return diff;
}

function arraysEqual(a: any[], b: any[]): boolean {
	return (
		a.length === b.length &&
		a.every((val, index) => {
			if (isPlainObject(val) && isPlainObject(b[index])) {
				return JSON.stringify(val) === JSON.stringify(b[index]);
			}
			return val === b[index];
		})
	);
}
