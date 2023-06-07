import { isArray, each, get } from 'lodash';

export const sortUtils = {
	parseSortArray(sortArray) {
		const sort = {};

		if (!isArray(sortArray)) {
			sortArray = [].concat(sortArray);
		}

		each(sortArray, function (item) {
			sort[item.property || item.term] = get(item, 'direction', 'ASC').toUpperCase() === 'ASC' ? 1 : -1;
		});

		return sort;
	},
};
