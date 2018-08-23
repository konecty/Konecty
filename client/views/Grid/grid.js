/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Session.setDefault('selectedRecords', []);

Template.grid.helpers({
	data() {
		return __guard__(Models[__guard__(this.meta != null ? this.meta.document : undefined, x1 => x1.name)], x => x.find());
	},

	getValue(record, fieldName) {
		return record[fieldName];
	},

	isLockColumn(column) {
		return column.linkField === 'code';
	},

	getAlign(field) {
		if (['autoNumber', 'money', 'number', 'percentage'].includes(field.type)) {
			return 'right';
		}
		return 'left';
	},

	getMinWidth(column) {
		return parseInt(column.minWidth) || 150;
	},

	getLockWidth(columns) {
		let width = 40;
		if (columns != null) {
			for (let column of Array.from(columns)) {
				if (column.linkField === 'code') {
					width += parseInt(column.minWidth) || 150;
				}
			}
		}

		return width;
	},

	renderValue(template) {
		const {meta, column, record} = template.hash;
		const field = meta.document.fields[column.linkField];
		if ((field == null)) {
			return '';
		}

		const value = record[column.linkField];
		if (renderers[field.type] != null) {
			let renderedValue;
			if (field.isList === true) {
				renderedValue = renderers.list(value, field);
			} else {
				renderedValue = renderers[field.type](value, field) || '';
			}

			if ((field.isList === true) && (renderedValue != null) && (renderedValue !== '') && (value.length > 1)) {
				return `<div class="cell list-cell"><div class="list-cell-plus"><i class="fa fa-plus-square-o"></i></div><div class="list-cell-item">${renderedValue}</div></div>`;
			} else {
				return `<div class="cell">${renderedValue}</div>`;
			}
		}

		return `<div class="cell">${field.type}</div>`;
	},

	selectedRecordId() {
		return __guard__(Session.get('CurrentRecord'), x => x._id);
	},

	selectedRecords() {
		return Session.get('selectedRecords');
	},

	idIsSelected(id) {
		return Session.get('selectedRecords').indexOf(id) > -1;
	}
});

Template.grid.events({
	'changed .left header konecty-checkbox'(e) {
		return Grid.toggleAll(e.currentTarget);
	},

	'click .main .body tr'(e) {
		Session.set('CurrentRecord', this);
		return Grid.setCurrent(e.currentTarget);
	},

	'dblclick .main .body tr'(e) {
		Grid.clearSelections();
		return Grid.toggleCheckbox(e.currentTarget);
	},

	'changed .body .checkbox > konecty-checkbox'(e) {
		let selectedRecords = Session.get('selectedRecords');
		Grid.setSelected(e.currentTarget);
		if (e.originalEvent.detail.value === true) {
			selectedRecords.push(e.currentTarget.name);
		} else {
			selectedRecords = _.without(selectedRecords, e.currentTarget.name);
		}
		return Session.set('selectedRecords', selectedRecords);
	},

	'mouseenter .grid .left tbody > tr'(e) {
		return Grid.mouseEnter(e.currentTarget);
	},

	'mouseleave .grid .left tbody > tr'(e) {
		return Grid.mouseLeave(e.currentTarget);
	},

	'mouseenter .grid .main tbody > tr'(e) {
		return Grid.mouseEnter(e.currentTarget);
	},

	'mouseleave .grid .main tbody > tr'(e) {
		return Grid.mouseLeave(e.currentTarget);
	},

	'click .list-cell-plus'(e) {
		let values = this.record[this.column.linkField];
		if ((values != null ? values.length : undefined) <= 1) {
			return;
		}

		const field = this.meta.document.fields[this.column.linkField];

		values = _.map(values, value => renderers[field.type](value, field) || '');

		Tooltip.show({
			el: e.currentTarget,
			text: values.join(', '),
			type: "list left"
		});

		e.preventDefault();
		return e.stopPropagation();
	}
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}