/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.checkGroup = class checkGroup extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.checkGroup');
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	getOptions() {
		let label;
		const data = this.data();
		let options = [];
		if (Match.test(data.options, Object)) {
			options = ((() => {
				const result = [];
				for (let value in data.options) {
					label = data.options[value];
					result.push({value, label});
				}
				return result;
			})());
		} else if (Match.test(data.options, [Object])) {
			({ options } = data);
		}

		options = _.sortBy(options, item => Blaze._globalHelpers.i18n(item.label));

		return options;
	}

	isChecked(name) {
		const value = this.value.get();
		if (_.isArray(value)) {
			return {
				checked: Array.from(value).includes(name)
			};
		}
		return {checked: false};
	}

	getValue() {
		let values = [];
		this.componentChildren().forEach(function(cp) {
			if (cp.getValue() === true) {
				return values.push(cp.getName());
			}
		});

		if (values.length === 0) {
			values = undefined;
		}
		return values;
	}
});
Cls.initClass();