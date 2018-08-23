/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sortUtils = {};

sortUtils.parseSortArray = function(sortArray) {
	const sort = {};

	if (!_.isArray(sortArray)) {
		sortArray = [].concat(sortArray);
	}

	_.each(sortArray, function(item) {
		if (item.direction == null) { item.direction = 'ASC'; }
		return sort[item.property || item.term] = item.direction.toUpperCase() === 'ASC' ? 1 : -1;
	});

	return sort;
};
