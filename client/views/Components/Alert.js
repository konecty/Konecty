/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Alert = class Alert extends KonectyComponent {
	static initClass() {
		this.register('Alert');
	}

	mixins() { return [
		new Mixin.Class([
			'modal',
			'progress',
			'centered',
			'clean'
		]),
		new Mixin.Transitions
	]; }

	checkAttributes() {
		const data = this.data();
		this.type.set(data.type || this.params.type || "alert");
		this.title.set(data.title || this.params.title || "");
		this.actionText.set(data.actionText || this.params.actionText || "Send");
		this.cancelText.set(data.cancelText || this.params.cancelText || "Cancel");
		return this.closeText.set(data.closeText || this.params.cancelText || "Close");
	}

	onCreated() {
		const data = this.data();
		this.params = data.params || {};
		this.opened = false;
		this.message = new ReactiveVar(data.message || this.params.message || "");
		this.input = new ReactiveVar(false);
		this.actionVisible = new ReactiveVar(false);
		this.cancelVisible = new ReactiveVar(false);
		this.closeVisible = new ReactiveVar(false);
		this.actionText = new ReactiveVar("");
		this.cancelText = new ReactiveVar("");
		this.closeText = new ReactiveVar("");
		this.title = new ReactiveVar("");
		this.type = new ReactiveVar("");
		this.checkAttributes();
		return this.checkType();
	}

	onRendered() {
		return this.element = this.firstNode();
	}
		// @open()

	events() { return [{
		"click .cp-button.cancel": this.action,
		"click .cp-button.close": this.close,
		"click .cp-button.action": this.action
	}
	]; }

	getInputValue() {
		const input = BlazeComponent.getComponentForElement(this.element.querySelector(".cp-component-field-text"));
		if (input) { return input.getValue(); } else { return null; }
	}

	action(event) {
		const self = this;
		this.block();
		this.load();

		if (this.type === "prompt") { this.params.value = this.getInputValue(); }

		if (this.params.waitOn) {
			this.params.waitOn(this.params, status =>
				setTimeout(function() {
					if (status) {
						self.callFirstWith(self, 'addClass', "success");
						self.message.set(self.params.successMsg);
					} else {
						self.callFirstWith(self, 'addClass', "fail");
						self.message.set(self.params.failMsg || self.params.cancelMsg);
					}
					return self.complete();
				}
				, 1)
			);
			return;
		} else {
			if (!this.params.resultMessage && !this.params.successMsg) {
				this.close();
				return;
			}
			else {}
		}
				// do nothing

		if (event.currentTarget.classList.contains("cancel")) {
			this.message.set(this.params.failMsg || this.params.cancelMsg);
		} else {
			this.message.set(this.params.successMsg || this.params.resultMessage);
		}

		return setTimeout(() => self.complete()
		, 100);
	}

	complete() {
		const self = this;
		this.input.set(false);
		this.buttonsState(false, false, true);
		this.callFirstWith(this, 'addClass', 'ended');
		if (this.params.autoClose) {
			return setTimeout(() => self.close()
			, this.params.autoClose * 1000);
		}
	}

	block() {
		return this.callFirstWith(this, 'addClass', 'blocked');
	}

	unblock() {
		return this.callFirstWith(this, 'removeClass', 'blocked');
	}

	load() {
		const self = this;
		return setTimeout(() => self.callFirstWith(self, 'addClass', 'started')
		, 10);
	}

	checkType() {
		if (this.type.get() === "confirm") {
			this.confirm();
			return;
		}
		if (this.type.get() === "alert") {
			this.alert();
			return;
		}
		if (this.type.get() === "prompt") {
			this.prompt();
			return;
		}
	}

	confirm() {
		this.input.set(false);
		return this.buttonsState(true, true, false);
	}

	alert() {
		this.input.set(false);
		return this.buttonsState(false, false, true);
	}

	prompt() {
		this.input.set(true);
		return this.buttonsState(true, true, false);
	}

	buttonsState(action, cancel, close) {
		this.actionVisible.set(action || false);
		this.cancelVisible.set(cancel || false);
		return this.closeVisible.set(close || false);
	}

	open() {
		this.opened = true;

		if (this.input.get() === true) {
			const input = this.element.querySelector("input");
			setTimeout(() => input.focus()
			, 100);
		}

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