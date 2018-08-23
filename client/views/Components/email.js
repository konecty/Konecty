/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.email = class email extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.email');
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	buttons() { return [
		{icon: "envelope-o", class: "icon small", onClick: this.mailto.bind(this)}
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
			"Trabalho",
			"Residencial"
		];
	}

	mailto() {
		return window.location.href = `mailto:${this.getAddress()}`;
	}

	getAddress() {
		return __guard__(this.value.get(), x => x.address);
	}

	getType() {
		return __guard__(this.value.get(), x => x.type);
	}

	getValue() {
		if (!this.isRendered()) {
			return this.value.curValue;
		}

		const address = __guard__(this.child != null ? this.child.address : undefined, x => x.getValue());
		if (address != null) {
			const value =
				{address};

			const type = __guard__(this.child != null ? this.child.type : undefined, x1 => x1.getValue());

			if (type != null) {
				value.type = type;
			}

			return value;
		}
	}

	validate() {
		const value = this.getValue();
		if ((value == null) && (this.isRequired.get() === true)) {
			return this.setValid(false, 'field-required');
		} else {
			if ((value != null) && Match.test(value.address, String) && !value.address.match(/^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i)) {
				return this.setValid(false, 'invalid-email');
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