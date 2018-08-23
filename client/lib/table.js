/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Tables = (function() {

	let table = {};

	const updateSize = function() {
		// tem que somar o tamanho do scroll aqui, em ambos;
		table.limitX = table.main.body.table.get(0).offsetWidth - table.main.body.get(0).offsetWidth;
		return table.limitY = table.main.body.table.get(0).offsetHeight - table.main.body.get(0).offsetHeight;
	};

	const updateScrollY = function(e) {
		updateSize();
		table.main.scrollY -= e.deltaY;
		if (table.main.scrollY > table.limitY) {
			table.main.scrollY = table.limitY;
		}
		if (table.main.scrollY < 0) {
			table.main.scrollY = 0;
		}
		table.left.body.scrollTop(table.main.scrollY);
		return table.main.body.scrollTop(table.main.scrollY);
	};

	const updateScrollX = function(e) {
		updateSize();
		table.main.scrollX += e.deltaX;
		if (table.main.scrollX > table.limitX) {
			table.main.scrollX = table.limitX;
		}
		if (table.main.scrollX < 0) {
			table.main.scrollX = 0;
		}
		table.main.header.scrollLeft(table.main.scrollX);
		return table.main.body.scrollLeft(table.main.scrollX);
	};

	const scrollEvents = function() {
		table.main.body.bind("scroll", function(e) {
			table.main.scrollY = table.main.body.scrollTop();
			table.main.scrollX = table.main.body.scrollLeft();
			table.main.header.scrollLeft(table.main.scrollX);
			return table.left.body.scrollTop(table.main.scrollY);
		});

		table.left.body.bind("mousewheel", function(e) {
			if (Math.abs(e.deltaY) > 0) {
				updateScrollY(e);
			}
			if (Math.abs(e.deltaX) > 0) {
				return updateScrollX(e);
			}
		});

		return table.main.header.bind("mousewheel", function(e) {
			if (Math.abs(e.deltaX) > 0) {
				return updateScrollX(e);
			}
		});
	};

	const init = function(element) {
		table = $(element);
		table.left = table.find(".left");
		table.left.body = table.left.find(".body");
		table.main = table.find(".main");
		table.main.body = table.main.find(".body");
		table.main.header = table.main.find("header");
		table.main.body.table = table.main.body.find("table");

		table.main.scrollY = 0;
		table.main.scrollX = 0;
		return scrollEvents();
	};
	return {init};

})();