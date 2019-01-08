import { Login } from '../../imports/login';

Template.login.events({
	'click .submit button'() {
		Login.submit();
	},

	'keydown li input'(e) {
		if (e.which === 13) {
			e.preventDefault();
			Login.submit();
		}
	},

	'focus li input'(e) {
		const ipt = $(e.currentTarget);
		ipt.parent().addClass('focus');
	},

	'blur li input'(e) {
		const ipt = $(e.currentTarget);
		if (!ipt.val()) {
			ipt.parent().removeClass('focus hovered');
		}
	},

	'click li label'(e) {
		const lbl = $(e.currentTarget);
		lbl.next().focus();
	},

	'mouseenter li'(e) {
		const lbl = $(e.currentTarget);
		lbl.addClass('hovered');
	},

	'mouseleave li'(e) {
		const lbl = $(e.currentTarget);
		if (!lbl.hasClass('focus')) {
			lbl.removeClass('hovered');
		}
	}
});

// eslint-disable-next-line meteor/no-template-lifecycle-assignments
Template.login.rendered = function() {
	Login.init();
	setTimeout(() => Login.start(), 1000);
};
