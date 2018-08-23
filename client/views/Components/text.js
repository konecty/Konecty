/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Mask = (function() {
	const run = function(type, input, params) {
		let $input;
		if (params == null) { params = {}; }
		window.$.mask.definitions['1'] = '[0-1]';
		window.$.mask.definitions['2'] = '[0-2]';
		window.$.mask.definitions['3'] = '[0-3]';
		window.$.mask.definitions['5'] = '[0-5]';
		if (input) {
			$input = window.$(input);
		}
		switch (type) {
			case 'currency':
				var tag = 'update';
				if (input.initialized !== true) {
					input.initialized = true;
					tag = 'init';
				}

				return $input.autoNumeric(tag, {
					aSign: (params.symbol || 'R$') + ' ',
					aDec: ',',
					aSep: '.',
					mDec: 2,
					pattern: 'd*'
				}
				);
			case 'cep':
				return $input.mask('99999-999', {autoclear: false}).remask();
			case 'phone':
				return $input.mask('(99) 9999-9999?9', {autoclear: false});
			case 'cpf':
				return $input.mask('999.999.999-99', {autoclear: false}).remask();
			case 'date':
				return $input.mask('39/19/2999', {autoclear: false});
			case 'time':
				return $input.mask('29:59:59', {autoclear: false});
			case 'percentage':
				tag = 'update';

				if (input.value.trim() === '') {
					return;
				}

				if (input.initialized !== true) {
					input.initialized = true;
					tag = 'init';
				}

				return $input.autoNumeric(tag, {
					aSign: ' %',
					aDec: ',',
					aSep: '.',
					mDec: 2,
					pSign: 's',
					pattern: 'd*'
				}
				);
		}
	};

	return {run};
})();

const Validate = (function() {
	const number = function(type, element) {
		const value = element.value.trim();

		if (value.match(/^[0-9]*$/) && (type === "number")) {
			return true;
		}

		return false;
	};

	const run = function(type, element) {
		let check = true;
		switch (type) {
			case 'number':
				check = number(type, element);
				break;
		}
		return check;
	};

	return {run};
})();

const Cls = (this.Component.field.text = class text extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.text');
	
		this.prototype.setValueMatch = Match.OneOf(String, Number, undefined);
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	onCreated() {
		this.value = new ReactiveVar;
		return this.inputType = new ReactiveVar;
	}

	checkType() {
		if (this.type === "password") {
			return this.inputType.set("password");
		} else {
			return this.inputType.set("text");
		}
	}

	checkAttributes() {
		const data = this.data();
		this.input = this.firstNode().querySelector("input");
		if (data.class) { this.callFirstWith(this, 'addClass', data.class); }
		if (data.buttons) { return this.callFirstWith(this, 'addClass', `btns-${data.buttons.length}`); }
	}

	onRendered() {
		this.checkAttributes();
		return Meteor.autorun(() => {
			const data = this.data() || {};
			this.type = data.type || (data.field != null ? data.field.type : undefined) || "text";
			this.checkType();
			return Meteor.defer(() => {
				return Mask.run(this.type, this.input);
			});
		});
	}

	events() { return [{
		"click label"() {
			return this.input.focus();
		},

		"keyup input"() {
			this.validate();
			return Meteor.defer(() => {
				return this.fireEvent('value-changed');
			});
		},

		"blur input"() {
			return this.input.value = this.input.value.trim();
		}
	}
	]; }

	validate() {
		if (this.preventValidation === true) {
			return;
		}

		const value = this.getValue();
		if ((value == null) && (this.isRequired.get() === true)) {
			return this.setValid(false, 'field-required');
		} else {
			if (!Validate.run(this.type, this.input)) {
				return this.setValid(false);
			} else {
				return this.setValid(true);
			}
		}
	}

	realValue() {
		return (this.input != null ? this.input.value.trim() : undefined);
	}

	getTemplateValue() {
		let value = this.value.get();
		if (['currency', 'percentage'].includes(this.type)) {
			value = String(value).replace('.', ',');
		}

		return value;
	}

	getValue() {
		let value = this.input != null ? this.input.value.trim() : undefined;
		switch (this.type) {
			case 'number':
				value = parseInt(value);
				if (!_.isNaN(value)) {
					return value;
				}
				return;

			case 'currency': case 'percentage':
				if ((value == null) || (value.replace(/[^\d]/g, '') === '')) {
					return null;
				}

				value = parseFloat(value.replace(/[^\d,]/g, '').replace(',','.'));

				if (_.isNaN(value)) {
					return;
				}

				return  value;

			case 'phone':
				value = value.replace(/[^\d]/g, '').trim();
				if (value === '') {
					return undefined;
				}
				return value;

			default:
				if (__guardMethod__(value, 'trim', o => o.trim()) === "") {
					return;
				} else {
					return value;
				}
		}
	}
});
Cls.initClass();

function __guardMethod__(obj, methodName, transform) {
  if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}