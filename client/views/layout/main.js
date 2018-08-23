/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.main.events({
	"click .list li"(e) {
		return Layout.view.open();
	},
	"click konecty-button[icon='filter']"(e) {
		return Layout.filters.toggle();
	},
	"click konecty-button[icon='map-marker']"(e) {
		return Modal.open("modalAddress");
	}
});

Template.main.rendered = function() {
	Tables.init(document.querySelector("div.grid"));
	return Tooltip.init(document.querySelector(".main-page"));
};