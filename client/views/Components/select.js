/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Cls = (this.Component.field.select = class select extends KonectyFieldComponent {
	static initClass() {
		this.register('Component.field.select');
	}

	mixins() { return [
		new Mixin.Class([
			'hidden',
			'done'
		]),
		new Mixin.Transitions,
		Mixin.Label,
		Mixin.Name,
		Mixin.Value,
		Mixin.Validation
	]; }

	onCreated() {
		this.selected = new ReactiveVar;
		this.items = new ReactiveVar;
		this.filter = new ReactiveVar;
		this.opened = new ReactiveVar(false);
		this.timing = {};
		this.items.set([
			{label: "Item A", value: "Item A"},
			{label: "Item B", value: "Item B"},
			{label: "Item C", value: "Item C"},
			{label: "Item D", value: "Item D"}
		]);

		return Tracker.autorun(() => {
			let value, label;
			const data = this.data() || {};

			if (Match.test(data.options, Object)) {
				this.setItems(((() => {
					const result = [];
					for (value in data.options) {
						label = data.options[value];
						result.push({value, label});
					}
					return result;
				})()));
			} else if (Match.test(data.options, [String])) {
				this.setItems(((() => {
					const result1 = [];
					for (value of Array.from(data.options)) { 						result1.push({value, label: value});
					}
					return result1;
				})()));
			} else if (Match.test(data.options, [Object])) {
				this.setItems(data.options);
			}

			if (data.class) { this.callFirstWith(this, 'addClass', data.class); }

			if ((data.field != null ? data.field.type : undefined) === 'lookup') {
				this.lookup = {
					field: data.field,
					meta: data.meta
				};
			}

			this.buffer = data.buffer || 400;
			return this.updateFilterBuffer = _.throttle(this.updateFilter, this.buffer);
		});
	}

	onRendered() {
		this.element = this.firstNode();
		this.input = this.element.querySelector("input");
		this.list = this.element.querySelector("ul");

		return Tracker.autorun(() => {
			const opened = this.opened.get();

			const transition = this.callFirstWith(this, 'whichEvent', 'transition');

			if (opened === true) {
				this.callFirstWith(this, 'removeClass', 'done');
				return this.callFirstWith(this, 'removeClass', 'hidden');
			} else {
				Meteor.setTimeout(() => {
					return this.callFirstWith(this, 'addClass', 'done');
				}
				, 200);

				return this.callFirstWith(this, 'addClass', 'hidden');
			}
		});
	}

	events() { return [{
		"click .holder": this.toggle,

		"blur input"() {
			this.opened.set(false);
			if (this.input.value.trim() === '') {
				return this.setValue(undefined);
			}
		},

		"click li"(e) {
			return this.select(e.currentTarget.getAttribute("data-value"));
		},

		"mouseenter li"(e) {
			return e.currentTarget.classList.add("hover");
		},

		"mouseleave li"(e) {
			return e.currentTarget.classList.remove("hover");
		},

		"keydown input": this.keyDown,

		"keyup input": this.keyUp
	}
	]; }

	toggle() {
		return this.opened.set(!this.opened.curValue);
	}

	next() {
		const lis = this.element.querySelectorAll("li");
		const next = null;
		for (let i in lis) {
			if (lis[i].classList != null ? lis[i].classList.contains("hover") : undefined) {
				lis[i].classList.remove("hover");
				if (!lis[(i*1)+1]) {
					lis[0].classList.add("hover");
				} else {
					lis[(i*1)+1].classList.add("hover");
				}
				return;
			}
		}
		return lis[0].classList.add("hover");
	}

	prev() {
		const lis = this.element.querySelectorAll("li");
		const next = null;
		for (let i in lis) {
			if (lis[i].classList.contains("hover")) {
				lis[i].classList.remove("hover");
				if (!lis[(i*1)-1]) {
					lis[lis.length-1].classList.add("hover");
				} else {
					lis[(i*1)-1].classList.add("hover");
				}
				return;
			}
		}
		return lis[lis.length-1].classList.add("hover");
	}

	enter() {
		const li = this.element.querySelector(".hover");
		if (li) {
			this.setValue(li.getAttribute("data-value"));
			return this.toggle();
		}
		else {}
	}
			// strict test

	stop(event) {
		event.preventDefault();
		event.stopImmediatePropagation();
		return event.stopPropagation();
	}

	keyUp(event) {
		const key = event.which;

		if (![9, 27, 37, 38, 39, 40].includes(key)) {
			return this.updateFilterBuffer();
		}
	}

	keyDown(event) {
		const key = event.which;
		const self = this;

		if (key === 27) {
			if ((this.selected.curValue != null ? this.selected.curValue.value : undefined) != null) {
				const { value } = this.selected.curValue;
				this.setValue(undefined);
				Meteor.defer(() => {
					return this.setValue(value);
				});
			}
			this.opened.set(false);
			return;
		}

		if (key !== 9) {
			this.opened.set(true);
		}

		if (key === 40) {
			this.stop(event);
			this.next();
			return;
		}

		if (key === 38) {
			this.stop(event);
			this.prev();
			return;
		}

		if (key === 13) {
			this.enter();
			return;
		}
	}

	updateFilter() {
		let filter = this.input.value;
		if ((filter != null ? filter.trim() : undefined) !== '') {
			filter = filter.trim();
		} else {
			filter = undefined;
		}

		if ((this.lookup == null)) {
			return this.filter.set(filter);
		} else {
			const requestOptions = {
				document: this.lookup.meta.document._id,
				field: this.lookup.field.name,
				start: 0,
				limit: this.lookup.limit || 20,
				search: filter
			};

			return Meteor.call('data:find:byLookup', requestOptions, (err, result) => {
				if (err != null) {
					return console.log(err);
				}

				const items = [];
				for (let item of Array.from(result.data)) {
					items.push({
						label: renderers.lookup(item, this.lookup.field),
						value: item._id,
						record: item
					});
				}

				return this.items.set(items);
			});
		}
	}

	getFilteredItems() {
		const items = this.items.get();
		if (!_.isArray(items)) {
			return [];
		}

		const filter = this.filter.get();

		if ((filter == null)) {
			return items;
		}

		const filteredItems = [];
		for (let item of Array.from(items)) {
			if (this.itemMatchFilter(item, filter)) {
				filteredItems.push(item);
			}
		}

		return filteredItems;
	}

	itemMatchFilter(item, filter) {
		filter = filter.replace(/a/i, '[aAÁáÀàÂâÃã]');
		filter = filter.replace(/e/i, '[eEÉéÈèÊê]');
		filter = filter.replace(/i/i, '[iIÍíÌìÎî]');
		filter = filter.replace(/o/i, '[oOÓóÒòÔôÕõ]');
		filter = filter.replace(/u/i, '[uUÚúÙùÛûüÜ]');
		filter = filter.replace(/c/i, '[cCçÇ]');
		filter = filter.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

		const regex = new RegExp(filter, 'i');
		return regex.test(item.value) || regex.test(item.label);
	}

	setSelected(value) {
		const items = this.items.curValue;
		let found = false;
		for (let item of Array.from(items)) {
			if (item.value === value) {
				found = true;
				this.selected.set(item);
			}
		}

		if (!found) {
			this.selected.set(undefined);
		}

		Meteor.defer(() => {
			if (this.isRendered()) {
				this.fireEvent('value-changed');
				return this.validate();
			}
		});
	}

	select(value) {
		return this.setValue(value);
	}

	getValue() {
		if (this.lookup != null) {
			return __guard__(this.selected.get(), x => x.record);
		}
		return __guard__(this.selected.get(), x1 => x1.value);
	}

	getSelected() {
		return this.selected.get();
	}

	getSelectedLabel() {
		const selected = this.selected.get();
		if ((selected != null ? selected.label : undefined) != null) {
			if (Match.test(selected.label, Object)) {
				return Blaze._globalHelpers.i18n(selected.label);
			}
			return selected.label;
		}
	}

	setItems(items) {
		return this.items.set(items);
	}

	setValue(value) {
		if ((this.lookup != null) && ((value != null ? value._id : undefined) != null)) {
			this.items.set([{
				label: renderers.lookup(value, this.lookup.field),
				value: value._id,
				record: value
			}]);
			this.setSelected(value._id);
			return;
		}

		return this.setSelected(value);
	}

	validate() {
		const value = this.getValue();
		if ((value == null) && (this.isRequired.get() === true)) {
			return this.setValid(false, 'field-required');
		} else {
			return this.setValid(true);
		}
	}
});
Cls.initClass();

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}