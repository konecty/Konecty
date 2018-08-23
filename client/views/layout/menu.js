/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const menuColors = [
	"materialBlue",
	"materialGreen",
	"materialRed",
	"materialAmber",
	"materialDeepOrange",
	"materialDeepPurple",
	"materialOrange",
	"materialLime"
];

const applyedColors = {};

Template.menu.helpers({
	getRandomColor(item) {
		if (!applyedColors[item._id]) {
			applyedColors[item._id] = _.sample(menuColors);
		}

		return applyedColors[item._id];
	},

	menu() {
		const query = {
			type: 'document',
			menuSorter: { $gt: 0
		},
			group: { $exists: false
		}
		};
		const options = {
			sort: {
				menuSorter: 1,
				_id: 1
			}
		};

		return Menu.find(query, options);
	},

	menuHasSubItems(_id) {
		const query = {
			document: _id,
			type: { $in: ['list', 'pivot']
		}
		};

		return Menu.find(query).count() > 0;
	},

	isCurrentMenu(_id) {
		return Session.get('main-menu-active') === _id;
	},

	isCurrentSubMenu(_id) {
		return Session.get('main-submenu-active') === _id;
	},

	subMenuLists(_id) {
		const query = {
			document: _id,
			group: { $exists: false
		},
			type: 'list'
		};

		return Menu.find(query).fetch();
	},

	subMenuPreferenceLists(_id) {
		const query = {
			document: _id,
			target: 'Display',
			type: 'list'
		};

		return (Models.Preference != null ? Models.Preference.find(query).fetch() : undefined);
	},

	subMenuReports(_id) {
		const query = {
			document: _id,
			group: { $exists: false
		},
			type: 'pivot'
		};

		return Menu.find(query).fetch();
	},

	subMenuPreferenceReports(_id) {
		const query = {
			document: _id,
			target: 'Display',
			type: 'pivot'
		};

		return (Models.Preference != null ? Models.Preference.find(query).fetch() : undefined);
	},

	subMenuModules(_id) {
		const query =
			{group: _id};

		return Menu.find(query).fetch();
	}
});

Template.menu.events({
	"click .item > a"(e) {
		const parent = $(e.currentTarget).parent();
		const nav = parent.find("nav");
		const a = nav.find("a");
		const p = nav.find("p");
		if (parent.hasClass("opened")) {
			parent.removeClass("opened");
			nav.css("max-height", 0);
		} else {
			parent.addClass("opened").siblings().removeClass("opened");
			nav.css("max-height", (a.outerHeight() * a.length) + (p.outerHeight() * p.length));
		}
		// Layout.mainMenu.click(e.currentTarget)
		e.preventDefault();
		return e.stopPropagation();
	},

	"click .control"(e) {
		return Layout.subMenu.toggle();
	},

	"click nav > a"(e) {
		return Layout.updateMainColor(e.currentTarget);
	},

	"mouseenter .wrapper"(e) {
		return $(e.currentTarget).parent().addClass("hover");
	},
	"mouseleave .wrapper"(e) {
		return $(e.currentTarget).parent().removeClass("hover");
	}
});
