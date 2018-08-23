/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Grid = {};

this.Grid.clearSelections = function() {
	if (document.selection && document.selection.empty) {
		return document.selection.empty();
	} else if (window.getSelection) {
		const sel = window.getSelection();
		return sel.removeAllRanges();
	}
};

this.Grid.setCurrent = function(element) {
	const current = element.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*)?/i,"$2$3");
	const grid = document.querySelector(".grid");
	const line = grid.querySelectorAll(`tr.${current}`);
	const selected = grid.querySelectorAll("tr.current");
	for (var i of Array.from(selected)) {
		i.className = i.className.replace(/(current)(\s)?/,"").trim();
	}
	return (() => {
		const result = [];
		for (i of Array.from(line)) {
			if (!i.className.match(/current/)) {
				result.push(i.className = (i.className + " current").trim());
			} else {
				result.push(i.className = i.className.replace(/(current)(\s)?/,"").trim());
			}
		}
		return result;
	})();
};

this.Grid.cleanCurrent = function() {
	const current = document.querySelectorAll(".grid tr.current");
	return Array.from(current).map((i) =>
		(i.className = i.className.replace(/(current)(\s)?/,"").trim()));
};

this.Grid.setSelected = function(element) {
	const current = element.parentNode.parentNode.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*)?/i,"$2$3");
	const grid = document.querySelector(".grid");
	const line = grid.querySelectorAll(`tr.${current}`);
	const state = element.checked;
	return (() => {
		const result = [];
		for (let i of Array.from(line)) {
			console.log(line);
			result.push(i.className = state ? (i.className + " selected").trim() : i.className.replace(/(selected)(\s)?/,"").trim());
		}
		return result;
	})();
};

this.Grid.mouseEnter = function(element) {
	const current = element.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*|$)/i,"$2$3");
	const grid = document.querySelector(".grid");
	const line = grid.querySelectorAll(`tr.${current}`);
	if (!element.className.match("hover")) {
		return Array.from(line).map((i) =>
			(i.className = (i.className + " hover").trim()));
	}
};

this.Grid.mouseLeave = function(element) {
	const current = element.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*|$)/i,"$2$3");
	const grid = document.querySelector(".grid");
	const line = grid.querySelectorAll(`tr.${current}`);
	if (element.className.match("hover")) {
		return Array.from(line).map((i) =>
			(i.className = i.className.replace(/(hover)(\s)?/,"").trim()));
	}
};

this.Grid.toggleCheckbox = function(element) {
	const current = element.className.replace(/(.*)?(record\-)([a-z0-9]+)(.*|$)/i,"$2$3");
	const grid = document.querySelector(".grid");
	const checkbox = grid.querySelector(`tr.${current} konecty-checkbox`);
	if (checkbox) {
		checkbox.toggle();
	}
	return this.clearSelections();
};


this.Grid.toggleAll = function(element) {
	const grid = document.querySelector(".grid");
	const lines = grid.querySelectorAll(".body konecty-checkbox");
	let all = false;
	for (var i of Array.from(lines)) {
		if (i.checked === false) {
			all = true;
			break;
		}
	}
	return (() => {
		const result = [];
		for (i of Array.from(lines)) {
			result.push(i.checked = all);
		}
		return result;
	})();
};