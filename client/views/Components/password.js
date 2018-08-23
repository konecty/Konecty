/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.password = class password extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.password');
	}

	mixins() { return [
		new Mixin.Class([
			'holder',
			'hidden'
		]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	events() { return [{
		'blur input': this.onBlur,
		'keyup .password input': this.keyUp,
		'keydown .password input': this.keyDown,
		'keyup .confirmation input': this.keyUp,
		'keydown .confirmation input': this.keyDown,
		'value-changed .cp-component-field-text': this.onValueChanged
	}
	]; }

	onValueChanged() {
		this.fireEvent('value-changed');
		return this.validate();
	}

	keyUp() {
		console.log("KEY UP");
		return this.checkValue();
	}

	keyDown(e) {
		if ((e.which === 13) && (this.confirmationVisible === true)) {
			e.preventDefault();
			e.stopPropagation();
			return this.confirmation.focus();
		}
	}

	onCreated() {
		this.securityLevel = 0;
		return this.status = new ReactiveVar("LOL");
	}

	onRendered() {
		this.element = this.firstNode();
		this.password = this.element.querySelector(".password input");
		this.confirmation = this.element.querySelector(".confirmation input");
		this.confirmationVisible = false;
		return this.securityLevel = 0;
	}

	checkAttributes() {
		const data = this.data();
		if (data.value) { return this.setValue(data.value); }
	}

	checkValue() {
		this.checkSecurity();
		this.checkConfirmation();
		this.confirmationVisible = this.securityLevel >= 5;
		this.checkStatus();
		if (this.statusVisible) { this.callFirstWith(this, 'addClass', "status"); } else { this.callFirstWith(this, 'removeClass', "status"); }
		if (this.strengthVisible) { this.callFirstWith(this, 'addClass', "strength"); } else { this.callFirstWith(this, 'removeClass', "strength"); }
		if (this.confirmationVisible) { return this.callFirstWith(this, 'removeClass', "hidden"); } else { return this.callFirstWith(this, 'addClass', "hidden"); }
	}

	checkConfirmation() {
		password = this.password.value.trim();
		const confirmation = this.confirmation.value.trim();

		if ((password !== "") && (password !== confirmation)) {
			return this.confirmation.invalid = true;
		} else {
			return this.confirmation.invalid = false;
		}
	}

	checkSecurity() {
		const passValue = this.password.value;
		let strength = 0;
		if (passValue) {
			if (passValue.length >= 6) {
				strength += 2;
			}
			if (passValue.length >= 8) {
				strength += 1;
			}
			if (passValue.length >= 10) {
				strength += 1;
			}
			if (passValue.match(/[\W]/g)) {
				strength += 2;
			}
			if (passValue.match(/[A-Z]/g)) {
				strength += 1;
			}
			if (passValue.match(/[a-z]/g)) {
				strength += 1;
			}
			if (passValue.match(/[0-9]/g)) {
				strength += 1;
			}
		}
		this.callFirstWith(this, 'removeClass', `_${this.securityLevel}`);
		this.securityLevel = strength > 10 ? 10 : strength;
		return this.callFirstWith(this, 'addClass', `_${this.securityLevel}`);
	}

	checkStatus() {
		const passValue = this.password.value;
		console.log("STATUS GET");
		console.log(this.status.get());
		if (passValue != null) {
			this.strengthVisible = true;
			if ((passValue.length > 0) && (this.securityLevel < 5)) {
				this.statusVisible = true;
				this.status.set("Senha muito fraca");
				return;
			} else {
				if ((this.confirmationVisible === true) && (this.confirmation.invalid === false)) {
					this.statusVisible = true;
					this.status.set("Senha válida");
					return;
				}
				// if isdirty
				if ((this.confirmationVisible === true) && (this.confirmation.invalid === true)) {
					this.statusVisible = true;
					this.status.set("Confirme sua senha");
					return;
				}
				this.status.set("");
			}
		} else {
			this.strengthVisible = false;
		}
		return this.statusVisible = false;
	}

	onBlur() {}
		// @value.set @componentChildren()[0].realValue()

	getTemplateValue() {
		return this.value.get();
	}

	getValue() {
		if (!this.isRendered()) {
			return this.value.curValue;
		}

		if (this.confirmation.invalid === false) {
			const value = this.password.value.trim();
			if (value !== "") {
				return value;
			}
		}
		return undefined;
	}

	validate() {
		if ((this.confirmation != null ? this.confirmation.invalid : undefined) === true) { 
			return this.setValid(false, 'invalid-password');
		} else {
			const value = this.getValue();
			if ((value == null) && (this.isRequired.get() === true)) {
				return this.setValid(false, 'field-required');
			} else {
				return this.setValid(true);
			}
		}
	}
});
Cls.initClass();

