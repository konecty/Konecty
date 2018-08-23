/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.personName = class personName extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.personName');
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	events() { return [
		{'value-changed .cp-component-field-text': this.onValueChanged}
	]; }

	onValueChanged() {
		this.validate();
		return this.fireEvent('value-changed');
	}

	getTemplateValue() {
		return this.value.get();
	}

	getValue() {
		const first = __guard__(this.child != null ? this.child.first : undefined, x => x.getValue());

		let value = undefined;
		if (first != null) {
			value =
				{first};

			const last = __guard__(this.child != null ? this.child.last : undefined, x1 => x1.getValue());
			if (last != null) {
				value.last = last;
				value.full = first + ' ' + last;
			}
		}

		return value;
	}

	validate() {
		const value = this.getValue();
		if (((value != null ? value.first : undefined) == null) && (this.isRequired.get() === true)) {
			return this.setValid(false, 'field-required');
		} else {
			return this.setValid(true);
		}
	}
});
Cls.initClass();
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}