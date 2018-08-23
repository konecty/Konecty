/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.radioGroup = class radioGroup extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.radioGroup');
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	events() { return [
		{'konecty-change .cp-component-field-radio': this.onChange}
	]; }

	onChange(event) {
		const cp = this.getComponentFromEvent(event);
		if (cp.value.curValue === true) {
			return Array.from(this.componentChildren()).filter((child) => child !== cp).map((child) =>
				child.setValue(false));
		}
	}

	getOptions() {
		const data = this.data();
		if (Match.test(data.options, Object)) {
			return ((() => {
				const result = [];
				for (let value in data.options) {
					const label = data.options[value];
					result.push({value, label});
				}
				return result;
			})());
		}

		return data.options;
	}

	isChecked(name) {
		const value = this.value.get();
		return {
			checked: name === value
		};
	}

	getValue() {
		for (let child of Array.from(this.componentChildren())) {
			if (child.getValue() === true) {
				return child.getName();
			}
		}
	}
});
Cls.initClass();
