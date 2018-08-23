/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class filterItem extends KonectyComponent {
	static initClass() {
		this.register('filterItem');
	}

	getFieldNameForTemplate(field) {
		let name = `field${_.capitalize(field.type)}`;

		const newComponents = {
			autoNumber: 'Component.field.text',
			boolean: 'Component.field.switch',
			date: 'Component.field.date',
			dateTime: 'Component.field.dateTime',
			email: 'Component.field.text',
			money: 'Component.field.currency',
			number: 'Component.field.text',
			percentage: 'Component.field.percentage',
			personName: 'Component.field.text',
			phone: 'Component.field.text',
			text: 'Component.field.text',
			time: 'Component.field.time',
			url: 'Component.field.text',
			lookup: 'Component.field.select'
		};

		if (newComponents[field.type]) {
			name = newComponents[field.type];
		}

		const template = Template[name];
		if (template != null) {
			return name;
		}
		return 'fieldNull';
	}


	events() { return [
		{"value-changed .component": _.throttle(this.valueChanged, 200)}
	]; }

	valueChanged() {
		return this.child.checkbox.setValue(true);
	}
}
filterItem.initClass();
