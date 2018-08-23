/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.listItem = class listItem extends KonectyComponent {
	static initClass() {
		this.register('Component.field.listItem');
	}

	events() { return [{
		'click button.remove-item': this.removeItem,
		'value-changed .list-component-area > .component': this.changedValueOfItem
	}
	]; }

	onCreated() {
		this.valid = new ReactiveVar(true);

		const parent = this.componentParent();
		parent.items.push(this);
		return parent.updateIsValid();
	}

	onRendered() {
		const parent = this.componentParent();
		const comp = this.componentChildren()[0];
		if (comp instanceof KonectyFieldComponent) {
			return Tracker.autorun(() => {
				this.valid.set(comp.valid.get());
				return parent.updateIsValid();
			});
		}
	}

	onDestroyed() {
		const parent = this.componentParent();
		parent.items = _.without(parent.items, this);
		return parent.updateIsValid();
	}

	changedValueOfItem(e) {
		const cp = this.getComponentFromEvent(e);
		__guard__(this.data().parentData, x => x.curValue = cp.getValue());
		return this.fireEvent('value-changed');
	}

	removeItem() {
		const parentValue = this.componentParent().value;
		const value = _.without(parentValue.curValue, this.data().parentData);
		return parentValue.set(value);
	}

	isDirty() {
		const comp = this.componentChildren()[0];
		if (!(comp instanceof KonectyFieldComponent)) {
			return false;
		}

		return comp.isDirty();
	}
});
Cls.initClass();

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}