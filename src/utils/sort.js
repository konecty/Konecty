import isArray from 'lodash/isArray';
import each from 'lodash/each';
import get from 'lodash/get';

const parseSortArray = function (sortArray) {
	const sort = {};

	if (!isArray(sortArray)) {
		sortArray = [].concat(sortArray);
	}

	each(sortArray, function (item) {
		sort[item.property || item.term] = get(item, 'direction', 'ASC').toUpperCase() === 'ASC' ? 1 : -1;
	});

	return sort;
};

export { parseSortArray };
