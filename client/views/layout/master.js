/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.master.helpers({
	modalOpenedClass() {},
		//return if Session.get("modalTemplate")? then 'opened' else 'hidden'
	modal() {
		return {
			header: Session.get("modalHeader"),
			footer: Session.get("modalFooter"),
			body: Session.get("modalContent")
		};
	},

	alertParams() {
		return{
			message: "Do you agree with this?",
			successMsg: "Congrats, you rock!",
			cancelMsg: "Ok, there you go!"
			//autoClose: 1 # time in s
			// waitOn: (params, next) ->
			// 	#params.value return the possible input value
			// 	#next function receives true/false for success/fail
			// 	setTimeout ->
			// 		if params.value is "42"
			// 			next(true)
			// 		else
			// 			next(false)
			// 	, 1000
		};
	}});

Template.master.created = function() {
	Session.set("modalHeader", "modalBaseHeader");
	Session.set("modalFooter", "modalBaseFooter");
	return Session.set("modalContent", "modalBaseContent");
};

Template.master.rendered = function() {
	Layout.update();
	return Layout.resize.bind();
};