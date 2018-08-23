/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Mixin.Value = class Value extends BlazeComponent {
	onCreated() {
		const mixinParent = this.mixinParent();
		mixinParent.value = new ReactiveVar;
		mixinParent.originalValue = new ReactiveVar;
		mixinParent.dirty = new ReactiveVar(false);

		if ((mixinParent.isDirty == null)) {
			mixinParent.isDirty = function() {
				return this.callFirstWith(this, 'isDirty');
			};
		}

		if ((mixinParent.setValue == null)) {
			mixinParent.setValue = function(value) {
				return this.callFirstWith(this, 'setValue', value);
			};
		}

		Tracker.autorun(function() {
			const data = mixinParent.data();
			if (data != null) {
				mixinParent.callFirstWith(null, 'setValue', data.value);
				return mixinParent.callFirstWith(null, 'setOriginalValue', data.value);
			}
		});

		return Tracker.autorun(() => {
			const dirty = mixinParent.dirty.get();
			if (dirty === true) {
				mixinParent.callFirstWith(null, 'addClass', 'dirty');
			} else {
				mixinParent.callFirstWith(null, 'removeClass', 'dirty');
			}

			if (Match.test(mixinParent.child, Object)) {
				return (() => {
					const result = [];
					for (let name in mixinParent.child) {
						const child = mixinParent.child[name];
						if (child.dirty != null) {
							result.push(child.dirty.set(dirty));
						} else {
							result.push(undefined);
						}
					}
					return result;
				})();
			}
		});
	}

	setOriginalValue(value) {
		if (value != null) {
			return this.mixinParent().originalValue.set(EJSON.parse(EJSON.stringify(value)));
		} else {
			return this.mixinParent().originalValue.set(value);
		}
	}

	setValue(value) {
		const mixinParent = this.mixinParent();
		if (mixinParent != null) {
			if ((mixinParent.setValueMatch == null) || Match.test(value, mixinParent.setValueMatch)) {
				return mixinParent.value.set(value);
			}
		}
	}

	getValue(value) {
		const mixinParent = this.mixinParent();
		return mixinParent.value.get();
	}

	checkDirty() {
		const mixinParent = this.mixinParent();
		const oldValue = mixinParent.originalValue.curValue;
		const newValue = mixinParent.callFirstWith(null, 'getValue');

		return mixinParent.dirty.set(!_.isEqual(oldValue, newValue));
	}

	isDirty() {
		const mixinParent = this.mixinParent();
		mixinParent.callFirstWith(null, 'checkDirty');

		return mixinParent.dirty.curValue;
	}
};