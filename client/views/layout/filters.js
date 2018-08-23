/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class filters extends KonectyComponent {
	static initClass() {
		this.register('filters');
	}

	events() { return [{
		"click .open-modal": this.openModal,
		"click .control": this.toggleVisibility,
		"click .fa-filter": this.filter,
		"keyup input": this.keyup
	}
	]; }

	toggleVisibility(e) {
		e.preventDefault();
		e.stopPropagation();
		return Layout.filters.toggle();
	}

	openModal(e) {
		return $("konecty-modal").get(0).open();
	}

	keyup(e) {
		const key = e.which;

		if (key === 13) {
			return this.filter();
		}
	}

	filter() {
		const filter = {};

		for (let child of Array.from(this.componentChildren())) {
			if ((child.componentName() === 'filterItem') && ((child.child != null ? child.child.value : undefined) != null)) {
				if (child.child.checkbox.getValue() === true) {
					const data = child.child.value.data();
					const { name } = data.field;
					const { type } = data.field;
					let value = child.child.value.getValue();

					if ((value == null) || (Match.test(value, String) && (value.trim() === ''))) {
						continue;
					}

					if (type === 'autoNumber') {
						value = parseInt(value);
					}

					filter[name] = value;
				}
			}
		}

		console.log(filter);
		return Session.set('filter', filter);
	}
}
filters.initClass();