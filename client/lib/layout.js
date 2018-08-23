/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Layout = (function() {

	let foxy = undefined;

	const mainMenu = (function() {
		const click = el => subMenu.open();
		return {click};
	})();

	const updateMainColor = function(el) {
		let item;
		if (el) {
			item = $(el).parents(".item");
		} else {
			item = foxy.find(".main-nav li.active");
		}
		if (item.length) {
			if (item.attr("data-color")) {
				if (foxy.get(0).className.match(/colored/i)) {
					return foxy.get(0).className = foxy.get(0).className.replace(/colored-[a-z0-9]+/i,`colored-${item.attr("data-color")}`);
				} else {
					return foxy.get(0).className += `colored-${item.attr("data-color")}`;
				}
			}
		}
	};

	var subMenu = (function() {
		let element = null;
		let opened = true;
		const triggerFirst = () => window.location.href = element.find(".sec-nav a").get(0).href;
		const toggle = function() {
			if (opened) { return close(); } else { return open(); }
		};
		var open = function() {
			opened = true;
			return foxy.removeClass("submenu-closed");
		};
		var close = function() {
			opened = false;
			return foxy.addClass("submenu-closed");
		};
		const set = () => element = foxy.find(".page-menu");
		const isOpened = () => opened;

		return {
			triggerFirst,
			isOpened,
			toggle,
			open,
			close,
			set
		};
	})();

	const filters = (function() {
		let element = null;
		let opened = true;
		const toggle = function() {
			if (opened) { return close(); } else { return open(); }
		};
		var open = function() {
			opened = true;
			return foxy.removeClass("filters-closed");
		};
		var close = function() {
			opened = false;
			return foxy.addClass("filters-closed");
		};
		const set = () => element = foxy.find(".page-filters");

		const isOpened = () => opened;

		return {
			isOpened,
			toggle,
			open,
			close,
			set
		};
	})();

	const view = (function() {
		let element = null;
		let opened = true;
		const toggle = function() {
			if (opened) { return close(); } else { return open(); }
		};
		var open = function() {
			opened = true;
			return foxy.removeClass("view-closed");
		};
		var close = function() {
			opened = false;
			return foxy.addClass("view-closed");
		};
		const set = () => element = foxy.find(".page-view");

		const isOpened = () => opened;

		return {
			isOpened,
			toggle,
			open,
			close,
			set
		};
	})();

	var closeAny = function() {
		if (foxy.main.outerWidth() < 320) {
			if (subMenu.isOpened()) {
				console.log("FECHANDO 1");
				subMenu.close();
				closeAny();
				return;
			}
			if (filters.isOpened()) {
				console.log("FECHANDO 2");
				filters.close();
				closeAny();
				return;
			}
			if (view.isOpened()) {
				console.log("FECHANDO 3");

				view.close();
				closeAny();
				return;
			}
		}
	};

	const resize = (function() {
		const win = $(window);
		const apply = function() {
			console.log(foxy.main.outerWidth());
			if (foxy.main.outerWidth() < 320) {
				return closeAny();
			}
		};
		const bind = () =>
			win.bind("resize.layout", () => apply())
		;
		return {
			bind,
			apply
		};
	})();

	const update = function() {
		foxy = $("#foxy");
		foxy.main = foxy.find(".page-main");
		// console.log(foxy.main)
		subMenu.set();
		filters.set();
		return view.set();
	};

	return {
		updateMainColor,
		mainMenu,
		resize,
		update,
		view,
		filters,
		subMenu
	};
})();