/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Button = class Button extends BlazeComponent {
	static initClass() {
		this.register('Button');
	}

	mixins() { return [
		new Mixin.Class(['button'])
	]; }

	onRendered() {
		return Tracker.autorun(() => {
			const data = this.data();
			if ((data == null)) {
				return;
			}

			if (data.tooltip != null) {
				this.firstNode().setAttribute("tooltip", data.tooltip);
			}

			if (data.icon != null) {
				this.callFirstWith(this, 'addClass', 'icon');
			}

			if (data.class) {
				return this.callFirstWith(this, 'addClass', data.class);
			}
		});
	}

	events() { return [
		{"click button": this.onClick}
	]; }

	onClick(e) {
		const data = this.data();
		if (_.isFunction(data.onClick)) {
			return data.onClick(e, this);
		}
	}
});
Cls.initClass();