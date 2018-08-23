/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import moment from 'moment';

const Cls = (this.Component.field.time = class time extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.time');
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

	check() {
		const value = this.child.time.realValue();
		const checked = this.checkTime(this.child.time.realValue());
		if (checked) {
			this.child.time.setValue(checked);
			this.child.time.validate();
			return true;
		}

		return false;
	}

	msToTime(ms) {
		if (ms != null) {
			return moment().startOf('day').add(ms).format('HH:mm:ss');
		}
		return '';
	}

	timeToMs(time) {
		time = time.split(':');
		return moment().startOf('day').add(time[0], 'hours').add(time[1], 'minutes').add(time[2], 'seconds').toDate().getTime() - moment().startOf('day').toDate().getTime();
	}

	checkTime(value) {
		value = value.replace(/[_]+/ig, "").split(":");
		if (value.length === 3) {
			if (String(value[0]).length === 1) {
				value[0] = `0${value[0]}`;
			}

			switch (String(value[1]).length) {
				case 0: value[1] = "00"; break;
				case 1: value[1] = `0${value[1]}`; break;
			}

			switch (String(value[2]).length) {
				case 0: value[2] = "00"; break;
				case 1: value[2] = `0${value[2]}`; break;
			}

			return value.join(":");
		}

		return false;
	}

	setValue(ms) {
		if ((ms == null)) {
			this.value.set(undefined);
			return;
		}

		ms = parseInt(ms);
		if (ms >= 0) {
			return this.value.set(ms);
		}
	}

	getValue() {
		if (!this.isRendered()) {
			return this.value.curValue;
		}

		const value = this.child.time.getValue();
		if (/[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(value)) {
			return this.timeToMs(value);
		}
		return undefined;
	}

	getValueFormated() {
		return this.msToTime(this.value.get());
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
