/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Tooltip = (function() {

	let body = {};
	let win = {};
	let tip = null;
	let timer = null;
	let over = false;

	const create = function(type) {
		if (!tip) {
			tip = $("<div/>").addClass(type);
			return body.append(tip);
		} else {
			return tip.get(0).className = type;
		}
	};

	const set = function(text) {
		if (tip.hasClass("list")) {
			const list = text.split(",");
			text = "<ul>";
			for (let i of Array.from(list)) {
				text +=`<li>${i}</li>`;
			}
			text += "</ul>";
		}
		return tip.html(text);
	};

	var setPosition = function(el, dir, force) {
		let left, top;
		const pos = el.offset();
		if (dir === "left") {
			top = (pos.top - (tip.outerHeight() / 2)) + (el.outerHeight() / 2);
			left = pos.left - tip.outerWidth() - 4;
			tip.removeClass("rigth top bottom").addClass("left");
		}
		if (dir === "top") {
			top = pos.top - tip.outerHeight() - 4;
			left = (pos.left - (tip.outerWidth() / 2)) + (el.outerWidth()/2);
			tip.removeClass("rigth left bottom").addClass("top");
		}
		if (dir === "bottom") {
			top = pos.top + el.outerHeight() + 4;
			left = (pos.left - (tip.outerWidth() / 2)) + (el.outerWidth()/2);
			tip.removeClass("rigth left top").addClass("bottom");
		}
		if (dir === "right") {
			top = (pos.top - (tip.outerHeight() / 2)) + (el.outerHeight() / 2);
			left = pos.left + el.outerWidth() + 4;
			tip.removeClass("bottom left top").addClass("right");
		}
		if (!force) {
			if (top < 0) {
				return setPosition(el, "bottom", 1);
			}
			if (left < 0) {
				return setPosition(el, "right", 1);
			}
			if ((top + tip.outerHeight()) > win.height()) {
				return setPosition(el, "top", 1);
			}
			if ((left + tip.outerWidth()) > win.width()) {
				return setPosition(el, "left", 1);
			}
		}
		return {
			top,
			left
		};
	};

	const position = function(el, tip) {
		el = $(el);
		let pos = null;
		if (tip.hasClass("left")) {
			pos = setPosition(el, "left");
		}
		if (tip.hasClass("right")) {
			pos = setPosition(el, "right");
		}
		if (tip.hasClass("top")) {
			pos = setPosition(el, "top");
		}
		if (!pos) {
			pos = setPosition(el, "top");
		}

		return tip.css({
			top: pos.top + "px",
			left: pos.left + "px"
		});
	};

	const enter = function(params) {
		const { el } = params;
		let type = "tooltip";
		if (el.getAttribute("tooltip-left")) {
			type += " left";
		}
		if (el.getAttribute("tooltip-right")) {
			type += " right";
		}
		if (el.getAttribute("tooltip-list")) {
			type += " list";
		}
		if (params.type) {
			type += ` ${params.type}`;
		}

		const text =  params.text ? params.text : el.getAttribute("tooltip") || el.getAttribute("tooltip-left") || el.getAttribute("tooltip-list") || el.getAttribute("tooltip-right");
		if (text != null ? text.length : undefined) {
			create(type);
			set(text);
			return position(el, tip);
		}
	};

	const show = function(params) {
		if (params.el && params.text) {
			enter(params);
			return $(params.el).on("mouseleave", e => leave(e));
		}
	};

	var leave = e => tip.addClass("hidden");

	const bind = () =>
		$('body')
			.on('mouseenter', '*[tooltip], *[tooltip-left], *[tooltip-list], *[tooltip-right]', function(e) {
				if (timer) {
					clearTimeout(timer);
					timer = null;
				}
				const delay = over ? 0 : 750;
				return timer = setTimeout(function() {
					over = true;
					timer = null;
					return enter({
						el: e.currentTarget});
				}
				, delay);
		}).on('mouseleave', '*[tooltip], *[tooltip-left], *[tooltip-list], *[tooltip-right]', function(e) {
				if (timer) {
					clearTimeout(timer);
					timer = null;
					return;
				}
				leave(e);
				return timer = setTimeout(function() {
					over = false;
					return timer = null;
				}
				, 250);
		})
	;

	const init = function(el) {
		win = $(window);
		body = $("body");
		return bind();
	};

	return {
		init,
		open,
		close,
		bind,
		show
	};

})();