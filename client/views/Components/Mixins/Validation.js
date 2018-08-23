/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Mixin.Validation = class Validation extends BlazeComponent {
	onCreated() {
		const mixinParent = this.mixinParent();
		mixinParent.valid = new ReactiveVar(true);
		mixinParent.isRequired = new ReactiveVar(false);
		mixinParent.preventValidation = false;

		Tracker.autorun(() => {
			const data = mixinParent.data() || {};

			if (data.preventValidation === true) {
				return mixinParent.preventValidation = true;
			}
		});

		if ((mixinParent.isValid == null)) {
			mixinParent.isValid = function() {
				return this.callFirstWith(this, 'isValid');
			};
		}

		if ((mixinParent.setValid == null)) {
			return mixinParent.setValid = function(valid, message) {
				return this.callFirstWith(this, 'setValid', valid, message);
			};
		}
	}

	onRendered() {
		const mixinParent = this.mixinParent();

		Tracker.autorun(() => {
			const valid = mixinParent.valid.get();
			if (valid === true) {
				return mixinParent.callFirstWith(null, 'removeClass', 'invalid');
			} else {
				return mixinParent.callFirstWith(null, 'addClass', 'invalid');
			}
		});

		Tracker.autorun(() => {
			const isRequired = mixinParent.isRequired.get();
			if (isRequired === true) {
				return mixinParent.callFirstWith(null, 'addClass', 'required');
			} else {
				return mixinParent.callFirstWith(null, 'removeClass', 'required');
			}
		});

		Tracker.autorun(() => {
			const data = mixinParent.data();
			if (__guard__(data != null ? data.field : undefined, x => x.isRequired) != null) {
				return mixinParent.isRequired.set(data.field.isRequired === true);
			}
		});

		return Tracker.autorun(() => {
			const isRequired = mixinParent.isRequired.get();
			if (Match.test(mixinParent.child, Object)) {
				return (() => {
					const result = [];
					for (let name in mixinParent.child) {
						const child = mixinParent.child[name];
						if (child.isRequired != null) {
							result.push(child.isRequired.set(isRequired));
						} else {
							result.push(undefined);
						}
					}
					return result;
				})();
			}
		});
	}

	isValid() {
		const mixinParent = this.mixinParent();
		return mixinParent.valid.curValue;
	}

	setValid(valid, message) {
		if (message == null) { message = false; }
		const mixinParent = this.mixinParent();
		if (valid === true) {
			mixinParent.valid.set(true);
		} else {
			mixinParent.valid.set(message);
		}

		if (Match.test(mixinParent.child, Object)) {
			return (() => {
				const result = [];
				for (let name in mixinParent.child) {
					const child = mixinParent.child[name];
					if (child.setValid != null) {
						result.push(child.setValid(valid));
					} else {
						result.push(undefined);
					}
				}
				return result;
			})();
		}
	}
};
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}