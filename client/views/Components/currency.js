/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.currency = class currency extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.currency');
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	events() { return [{
		'value-changed .cp-component-field-text': this.onValueChanged,
		'value-changed .cp-component-field-select': this.onValueChanged
	}
	]; }

	onValueChanged() {
		this.fireEvent('value-changed');
		return this.validate();
	}

	getOptions() {
		return [
			'BRL',
			'USD',
			'EUR'
		];
	}

	getCurrencyValue() {
		return __guard__(this.value.get(), x => x.value);
	}

	getCurrency() {
		return __guard__(this.value.get(), x => x.currency);
	}

	getValue() {
		currency = __guard__(this.child != null ? this.child.currency : undefined, x => x.getValue());
		const value = __guard__(this.child != null ? this.child.value : undefined, x1 => x1.getValue());

		if ((currency != null) && (value != null)) {
			return {
				currency,
				value
			};
		}
	}

	validate() {
		const value = this.getValue();
		if ((value == null) && (this.isRequired.get() === true)) {
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