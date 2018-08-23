/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.KonectyComponent = class KonectyComponent extends BlazeComponent {
	static initClass() {
	
		this.ids = {};
	}
	fireEvent(eventName) {
		if (this._componentInternals.templateInstance != null) {
			const firstNode = this.firstNode();
			if (firstNode != null) {
				const event = new CustomEvent(eventName, {detail: {component: this}});
				return this.firstNode().dispatchEvent(event);
			}
		}
	}

	getComponentFromEvent(event) {
		if (event instanceof jQuery.Event) {
			event = event.originalEvent;
		}

		return (event.detail != null ? event.detail.component : undefined);
	}

	static getCmp(selector) {
		let el = document.querySelector(selector);
		if (el == null) { el = document.querySelector(`#${selector}`); }
		if (el != null) {
			return KonectyComponent.getComponentForElement(el);
		}
	}
});
Cls.initClass();
