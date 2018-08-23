/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.dateTime = class dateTime extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.dateTime');
	}

	mixins() { return [
		new Mixin.Class(['holder']),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	events() { return [{
		'value-changed .cp-component-field-date': this.onValueChanged,
		'value-changed .cp-component-field-time': this.onValueChanged
	}
	]; }

	onValueChanged() {
		this.fireEvent('value-changed');
		return this.validate();
	}

	setValue(date) {
		if (_.isString(date)) {
			date = new Date(date);
		}

		return this.value.set(date);
	}

	getMidnightFromDate(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
	}

	getTimeFromMidnight(date) {
		if (!_.isDate(date)) {
			return 0;
		}

		const zero = this.getMidnightFromDate(date);
		return date.getTime() - zero.getTime();
	}

	getTime() {
		return this.getTimeFromMidnight(this.value.get());
	}

	getDate() {
		return this.value.get();
	}

	getValue() {
		const time = __guard__(this.child != null ? this.child.time : undefined, x => x.getValue());
		const date = __guard__(this.child != null ? this.child.date : undefined, x1 => x1.getValue());

		if ((date == null) || (time == null)) {
			return;
		}

		return new Date(this.getMidnightFromDate(date).getTime() + time);
	}

	validate() {
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