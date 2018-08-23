/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import moment from 'moment';

const Cls = (this.Component.field.date = class date extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.date');
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

	onBlur() {
		return Meteor.defer(() => {
			this.value.set(this.getValue());
			return this.validate();
		});
	}

	onValueChanged() {
		this.fireEvent('value-changed');
		return this.validate();
	}

	getFormated(date) {
		if (((date != null ? date.getDate : undefined) == null)) {
			return '';
		}

		return moment(date).format('L');
	}

	checkDate(value) {
		if ((value == null)) {
			return;
		}

		value = value.replace(/[_]+/ig, '').trim();
		if (value.replace(/[^0-9]/g, '') === '') {
			return;
		}

		value = value.split('/');
		date = new Date();
		if (value.length === 3) {
			if ((value[1] == null) || (value[1].length === 0)) {
				value[1] = date.getMonth() + 1;
			}

			if ((value[2] == null) || (value[2].length === 0)) {
				value[2] = date.getFullYear();
			} else if (value[2].length === 2) {
				value[2] = `20${value[2]}`;
			}

			return new Date(value[2], value[1] - 1, value[0]);
		}
	}

	getValue() {
		return this.checkDate(__guard__(this.child != null ? this.child.date : undefined, x => x.getValue()));
	}

	getTemplateValue() {
		return this.getFormated(this.value.get());
	}

	getValueFormated() {
		return this.getFormated(this.getValue());
	}

	validate() {
		if (this.preventValidation === true) {
			return;
		}

		const value = this.getValue();
		if ((value == null) && (this.isRequired.get() === true)) {
			return this.setValid(false, 'field-required');
		} else {
			return this.setValid(true);
		}
	}
});
Cls.initClass();

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}