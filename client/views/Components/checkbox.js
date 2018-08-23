/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.checkbox = class checkbox extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.checkbox');
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value
	]; }

	events() { return [
		{"click label"() { return this.toggle(); }}
	]; }

	setValue(value) {
		return this.toggle(value);
	}

	getValue() {
		return this.value.get();
	}

	toggle(value) {
		if (value != null) {
			this.value.set(value);
		} else {
			this.value.set(!this.value.curValue);
		}

		if (this.value.curValue === true) {
			this.callFirstWith(this, 'addClass', 'active');
		} else {
			this.callFirstWith(this, 'removeClass', 'active');
		}

		return this.fireEvent('value-changed');
	}
});
Cls.initClass();