/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.switch = class _switch extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.switch');
	}

	mixins() { return [
		new Mixin.Class(['holder']),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value
	]; }

	events() { return [{
		"click label"() { return this.toggle(); },
		"click .switch > i"() { return this.toggle(); }
	}
	]; }

	setValue(value) {
		this.value.set(value);

		if (this.value.curValue === true) {
			return this.callFirstWith(this, 'addClass', 'checked');
		} else {
			return this.callFirstWith(this, 'removeClass', 'checked');
		}
	}

	getValue() {
		return this.value.get();
	}

	toggle() {
		return this.setValue(!this.value.curValue);
	}

	isValid() {
		return true;
	}
});
Cls.initClass();
