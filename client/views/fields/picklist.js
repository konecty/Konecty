/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.fieldPicklist.helpers({
	singleSelect(field) {
		return field.maxSelected === 1;
	},

	withScroll(visual, field) {
		if ((visual != null ? visual.renderAs : undefined) != null) {
			return visual.renderAs === 'with_scroll';
		}
		return field.renderAs === 'with_scroll';
	}
});
