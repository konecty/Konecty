/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.visual.helpers({
	getFieldNameForTemplate(field) {
		let name = `field${_.capitalize(field.type)}`;

		const newComponents = {
			autoNumber: 'Component.field.display',
			boolean: 'Component.field.switch',
			date: 'Component.field.date',
			dateTime: 'Component.field.dateTime',
			email: 'Component.field.email',
			money: 'Component.field.currency',
			number: 'Component.field.text',
			password: 'Component.field.password',
			percentage: 'Component.field.percentage',
			personName: 'Component.field.personName',
			phone: 'Component.field.phone',
			text: 'Component.field.text',
			time: 'Component.field.time',
			url: 'Component.field.url',
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
	},


	markClass() {
		const classes = ['valid', 'required', 'invalid'];
		return _.sample(classes);
	},

	getLabel() {
		const { data } = Template.instance();
		const field = data.meta.document.fields[data.visual.name];
		return Blaze._globalHelpers.i18n(field.label, field.name);
	}
});

