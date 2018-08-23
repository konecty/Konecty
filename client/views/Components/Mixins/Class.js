/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Mixin.Class = class Class extends BlazeComponent {
	constructor(classes) {
		{
		  // Hack: trick Babel/TypeScript into allowing this before super.
		  if (false) { super(); }
		  let thisFn = (() => { return this; }).toString();
		  let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
		  eval(`${thisName} = this;`);
		}
		if (classes == null) { classes = []; }
		classes = ['component'].concat(classes);
		this.cls = new ReactiveVar(classes);
	}

	onCreated() {
		const mixinParent = this.mixinParent();

		return Tracker.autorun(function() {
			const data = mixinParent.data();
			if ((data != null ? data.class : undefined) != null) {
				const classes = data.class.split(' ');
				return Array.from(classes).map((item) =>
					mixinParent.callFirstWith(null, 'addClass', item));
			}
		});
	}

	getComponentName(mixinParent) {
		if (mixinParent == null) { mixinParent = this.mixinParent(); }
		return mixinParent.componentName().replace(/([^A-Z]+)([A-Z])/g, '$1-$2').replace(/\./g, '-').replace(/[-]{2,}/g, '-').toLowerCase();
	}

	mixinParent(mixinParent) {
		if (mixinParent != null) {
			this.addClass(`cp-${this.getComponentName(mixinParent)}`);
		}
		return super.mixinParent(...arguments);
	}

	onRendered() {
		const node = this.mixinParent().firstNode();
		if (node.id === "") {
			const compName = this.getComponentName();
			if (KonectyComponent.ids[compName] == null) { KonectyComponent.ids[compName] = 0; }
			return node.id = compName + '-' + ++KonectyComponent.ids[compName];
		}
	}

	addClass(newClass) {
		if (this.cls.curValue.indexOf(newClass) === -1) {
			return this.cls.set(this.cls.curValue.concat(newClass));
		}
	}

	getClass() {
		return this.cls.get().join(' ');
	}

	removeClass(oldClass) {
		return this.cls.set(_.without(this.cls.curValue, _.findWhere(this.cls.curValue, oldClass)));
	}
};
