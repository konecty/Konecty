/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Modal = class Modal extends KonectyComponent {
	static initClass() {
		this.register('Modal');
	}

	mixins() { return [
		new Mixin.Class([
			'modal',
			'hidden'
		]),
		new Mixin.Transitions
	]; }

	checkAttributes() {
		const data = this.data();
		if (data.progress) { this.callFirstWith(this, 'addClass', 'progress'); }
		if (data.centered) { this.callFirstWith(this, 'addClass', 'centered'); }
		if (data.clean) { return this.callFirstWith(this, 'addClass', 'clean'); }
	}

	onCreated() {
		this.cancel = "";
		this.opened = false;
		this.setTemplate();
		return this.open();
	}
		// @checkAttributes()

	onRendered() {
		return this.element = this.firstNode();
	}

	events() { return [{
		"click .cp-button.cancel": this.close,
		"click .cp-button.close": this.close
	}
	]; }

	getTemplate() {
		const data = this.data();
		return {
			header: data.header,
			footer: data.footer
		};
	}

	getData() {
		const data = this.data();
		return {
			header: data.header,
			body: data.body,
			footer: data.footer
		};
	}

	setTemplate(name) {}

	open() {
		this.opened = true;
		this.callFirstWith(this, 'addClass', 'opened');
		if (this.element) { this.callFirstWith(this, 'redraw', this.element); }
		return this.callFirstWith(this, 'removeClass', 'hidden');
	}

	close() {
		const self = this;
		this.opened = false;
		this.callFirstWith(this, 'addClass', 'hidden');
		const transition = this.callFirstWith(this, 'whichEvent', "transition");
		return this.element.addEventListener(transition, function(e) {
			self.element.removeEventListener(transition, arguments.callee);
			return self.callFirstWith(self, 'removeClass', 'opened');
		});
	}
});
Cls.initClass();