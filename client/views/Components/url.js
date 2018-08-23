/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.url = class url extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.url');
	
		this.prototype.setValueMatch = Match.Optional(String);
	}

	mixins() { return [
		new Mixin.Class([]),
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	buttons() { return [
		{icon: "link", class: "icon small", onClick: this.goTo.bind(this)}
	]; }

	events() { return [{
		'value-changed .cp-component-field-text': this.onValueChanged,
		'value-changed .cp-component-field-select': this.onValueChanged
	}
	]; }

	onValueChanged() {
		this.fireEvent('value-changed');
		return this.validate();
	}

	checkString(str) {
		const parts = str != null ? str.match(/^(HTTP|HTTPS|FTP|SSH)(\:\/\/)(.+)/i) : undefined;
		if (parts != null) {
			return {
				url: parts[3],
				protocol: parts[1]
			};
		}
		return {};
	}

	getOptions() {
		return [
			'http',
			'https',
			'ftp',
			'ssh'
		];
	}

	goTo() {
		return window.open(this.getValue());
	}

	// parseUrl: (url) ->
	// 	if not url?
	// 		return {}

	// 	check = @checkString(url)

	// 	if check isnt false
	// 		check.protocol = check.protocol.toLowerCase()
	// 		check.url = check.url.toLowerCase()

	// 	return {
	// 		value: if check.protocol then check.protocol + "://" + check.url else check.url
	// 		selected: check.protocol
	// 		url: check.url
	// 	}

	getProtocol() {
		return this.checkString(this.value.get()).protocol;
	}

	getUrl() {
		return this.checkString(this.value.get()).url;
	}

	getValue() {
		url = __guard__(this.child != null ? this.child.url : undefined, x => x.getValue());
		const protocol = __guard__(this.child != null ? this.child.protocol : undefined, x1 => x1.getValue());

		if ((url != null) && (protocol != null)) {
			return `${protocol}://${url}`;
		}

	}

	validate() {
		const value = this.getValue();
		if ((value == null) && (this.isRequired.get() === true)) {
			return this.setValid(false, 'field-required');
		} else {
			const urlRegExp = new RegExp('^(?:(?:https?|ftp|ssh)://)(?:\\S+(?::\\S*)?@)?(?:(?!(?:10|127)(?:\\.\\d{1,3}){3})(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))(?::\\d{2,5})?(?:/\\S*)?$', 'i');
			if (Match.test(value, String) && !value.match(urlRegExp)) {
				return this.setValid(false, 'invalid-url');
			} else {
				return this.setValid(true);
			}
		}
	}
});
Cls.initClass();

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}