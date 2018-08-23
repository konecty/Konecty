/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.list = class list extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.list');
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	onCreated() {
		return this.items = [];
	}

	events() { return [{
		'click button.add-item': this.addItem,
		'value-changed .list-component-area > .component'() { return this.fireEvent('value-changed'); }
	}
	]; }

	addItem() {
		const value = this.value.curValue || [];
		value.push(new ReactiveVar);

		return this.value.set(value);
	}

	setValue(values) {
		if (!_.isArray(values)) {
			values = [];
		}

		values = values.map(value => new ReactiveVar(value));

		return this.value.set(values);
	}

	reactiveValue() {
		return [].concat(this.value.get());
	}

	updateIsValid() {
		for (let item of Array.from(this.items)) {
			if (item.valid.curValue !== true) {
				this.valid.set(item.valid.curValue);
				return;
			}
		}

		return this.valid.set(true);
	}

	getValue() {
		const value = [];
		for (let item of Array.from(this.reactiveValue())) {
			value.push(item.curValue);
		}

		if (value.length === 0) {
			return undefined;
		}
		return value;
	}

	isDirty() {
		for (let item of Array.from(this.items)) {
			if (item.isDirty() === true) {
				return true;
			}
		}

		return false;
	}
});
Cls.initClass();