module.exports.Login = (function() {
	let login = {};
	let logging = false;

	const wait = function(time, callback) {
		if (new Date().getTime() - time < 2000) {
			setTimeout(() => callback(), 200);
			return false;
		}
		return true;
	};

	const load = function() {
		login.started = new Date().getTime();
		login.submit.addClass('active');
		login.submit.find('span').html(login.submit.data('wait'));
	};

	var unload = function(err) {
		const ok = wait(login.started, () => unload(err));
		if (!ok) {
			return;
		}
		login.submit.addClass('finished');
		setTimeout(function() {
			if (err) {
				login.submit.addClass('done');
				setTimeout(function() {
					login.submit.removeClass('finished active');
					login.submit.find('span').html(login.submit.defaultText);
					error('Revise seu nome de usuário e senha');
					setTimeout(() => login.submit.removeClass('done'), 10);
				}, 10);
			} else {
				logging = false;
			}
		}, 300);
	};

	const keyDown = function(e) {
		const key = e.which();
		if (key === 13) {
			e.preventDefault();
			e.stopPropagation();
			submit();
		}
	};

	const validate = function() {
		if (!login.user.val().length || !login.pass.val().length) {
			return false;
		}
		return true;
	};

	var error = function(msg) {
		login.status.addClass('error blink-background');
		login.status.html(msg);
		setTimeout(function() {
			login.status.removeClass('blink-background');
			logging = false;
		}, 1000);
	};

	var submit = function(e) {
		if (logging) {
			return;
		}
		logging = true;
		if (!validate()) {
			error('Você deve preencher os campos de login e senha');
		} else {
			load();
			Meteor.loginWithPassword(login.user.val(), login.pass.val(), function(err) {
				if (err && err.error) {
					unload(err.error);
				} else {
					unload();
				}
			});
		}
	};

	const start = function() {
		if (login) {
			login.removeClass('hidden');
		}
	};

	const init = function() {
		login = $('#konecty-login');
		login.submit = login.find('button');
		login.user = login.find('input[name=user]');
		login.pass = login.find('input[name=password]');
		login.status = login.find('p');
		login.submit.defaultText = login.submit.find('span').html();
	};

	return {
		init,
		start,
		submit
	};
})();
