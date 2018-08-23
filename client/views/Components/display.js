/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.display = class display extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.display');
	}

	mixins() { return [
		new Mixin.Class(['display']),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value
	]; }

	getValue() {
		return this.value.get();
	}

	isValid() {
		return true;
	}
});
Cls.initClass();