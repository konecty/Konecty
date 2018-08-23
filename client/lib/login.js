/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Login = (function() {

	let login = {};
	let logging = false;

	const wait = function(time, callback) {
		if ((new Date().getTime() - time) < 2000) {
			setTimeout(() => callback()
			, 200);
			return false;
		}
		return true;
	};

	const load = function() {
		login.started = new Date().getTime();
		login.submit.addClass("active");
		return login.submit.find("span").html(login.submit.data("wait"));
	};

	var unload = function(err) {
		const ok = wait(login.started, () => unload(err));
		if (!ok) { return; }
		login.submit.addClass("finished");
		return setTimeout(function() {
			if (err) {
				login.submit.addClass("done");
				return setTimeout(function() {
					login.submit.removeClass("finished active");
					login.submit.find("span").html(login.submit.defaultText);
					error("Revise seu nome de usuário e senha");
					return setTimeout(() => login.submit.removeClass("done")
					, 10);
				}
				, 10);
			} else {
				return logging = false;
			}
		}
		, 300);
	};

	const keyDown = function(e) {
		const key = e.which();
		if (key === 13) {
			e.preventDefault();
			e.stopPropagation();
			return submit();
		}
	};

	const validate = function() {
		if (!login.user.val().length || !login.pass.val().length) {
			return false;
		}
		return true;
	};

	var error = function(msg) {
		login.status.addClass("error blink-background");
		login.status.html(msg);
		return setTimeout(function() {
			login.status.removeClass("blink-background");
			return logging = false;
		}
		, 1000);
	};

	var submit = function(e) {
		if (logging) { return; }
		logging = true;
		if (!validate()) {
			return error("Você deve preencher os campos de login e senha");
		} else {
			load();
			return Meteor.loginWithPassword(login.user.val(), login.pass.val(), function(err) {
				if ((err != null) && (err.error != null)) {
					return unload(err.error);
				} else {
					return unload();
				}
			});
		}
	};

	const start = function() {
		if (login) {
			return login.removeClass("hidden");
		}
	};

	const init = function() {
		login = $("#konecty-login");
		login.submit = login.find("button");
		login.user = login.find("input[name=user]");
		login.pass = login.find("input[name=password]");
		login.status = login.find("p");
		return login.submit.defaultText = login.submit.find("span").html();
	};

	return {
		init,
		start,
		submit
	};
})();