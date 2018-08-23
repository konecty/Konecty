/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.percentage = class percentage extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.percentage');
	}

	mixins() { return [
		new Mixin.Class(['holder']),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	events() { return [{
		'blur input': this.onBlur,
		'value-changed .cp-component-field-text': this.onValueChanged
	}
	]; }

	onValueChanged() {
		this.fireEvent('value-changed');
		return this.validate();
	}

	onBlur() {
		return this.value.set(this.getValue());
	}

	getPercentValue() {
		const value = this.value.get();
		if (value != null) {
			return value * 100;
		}
		return '';
	}

	getValue() {
		let value = this.componentChildren()[0].getValue();
		if ((value == null)) {
			return;
		}

		value = value / 100;
		if (!_.isNaN(value)) {
			return value;
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
