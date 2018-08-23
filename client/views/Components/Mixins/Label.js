/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Mixin.Label = class Label extends BlazeComponent {
	onCreated() {
		const mixinParent = this.mixinParent();
		if (__guard__(mixinParent.data(), x => x.label) != null) {
			return mixinParent.callFirstWith(mixinParent, 'addClass', 'labeled');
		}
	}

	getLabel() {
		const data = this.mixinParent().data();
		if (_.isObject(data.label)) {
			return Blaze._globalHelpers.i18n(data.label);
		}
		return data.label;
	}

	getLabelHtml() {
		const mixinParent = this.mixinParent();
		const label = mixinParent.callFirstWith(null, 'getLabel');
		if (label != null) {
			return `\
<label>
	<span>${label}</span>
</label>\
`;
		}
		return "";
	}
};
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}