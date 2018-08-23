/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.phone = class phone extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.phone');
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
			{label:'+55', value: '55'},
			{label:'+1' , value: '1'},
			{label:'+39', value: '39'},
			{label:'+44', value: '44'},
			{label:'+49', value: '49'}
		];
	}

	getPhoneNumber() {
		return __guard__(this.value.get(), x => x.phoneNumber);
	}

	getCountryCode() {
		let countryCode = __guard__(this.value.get(), x => x.countryCode);
		if (countryCode != null) {
			countryCode = String(countryCode);
		}
		return countryCode;
	}

	getValue() {
		const countryCode = __guard__(this.child != null ? this.child.countryCode : undefined, x => x.getValue());
		const phoneNumber = __guard__(this.child != null ? this.child.phoneNumber : undefined, x1 => x1.getValue());

		if ((countryCode != null) && (phoneNumber != null)) {
			return {
				countryCode: parseInt(countryCode),
				phoneNumber
			};
		}
	}

	validate() {
		const value = this.getValue();
		if ((value == null) && (this.isRequired.get() === true)) {
			return this.setValid(false, 'field-required');
		} else {
			if ((value != null) && (value.phoneNumber.length < 10)) {
				return this.setValid(false, 'invalid-phone-number');
			} else {
				return this.setValid(true);
			}
		}
	}
});
Cls.initClass();

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}