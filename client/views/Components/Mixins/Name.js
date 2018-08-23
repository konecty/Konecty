/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Mixin.Name = class Name extends BlazeComponent {
	onRendered() {
		let mixinParent;
		if (this.mixinParent()) {
			mixinParent = this.mixinParent();
			this.name = mixinParent.data().name;
			if (this.name != null) {
				const componentParent = mixinParent.componentParent();
				if (componentParent != null) {
					if (componentParent.child == null) { componentParent.child = {}; }
					componentParent.child[this.name] = mixinParent;
				}
			}
		}

		this.mixinParent().getName = () => {
			return this.name;
		};
		return super.onRendered(...arguments);
	}
};
