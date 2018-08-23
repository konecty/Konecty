/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.login.events({
	"click .submit button"() {
		return Login.submit();
	},

	"keydown li input"(e) {
		if (e.which === 13) {
			e.preventDefault();
			return Login.submit();
		}
	},

	"focus li input"(e) {
		const ipt = $(e.currentTarget);
		return ipt.parent().addClass("focus");
	},

	"blur li input"(e) {
		const ipt = $(e.currentTarget);
		if (!ipt.val()) {
			return ipt.parent().removeClass("focus hovered");
		}
	},

	"click li label"(e) {
		const lbl = $(e.currentTarget);
		return lbl.next().focus();
	},

	"mouseenter li"(e) {
		const lbl = $(e.currentTarget);
		return lbl.addClass("hovered");
	},

	"mouseleave li"(e) {
		const lbl = $(e.currentTarget);
		if (!lbl.hasClass("focus")) {
			return lbl.removeClass("hovered");
		}
	}
});

Template.login.rendered = function() {
	Login.init();
	return setTimeout(() => Login.start()
	, 1000);
};