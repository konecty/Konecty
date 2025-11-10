/* eslint-disable no-undef */
/*!
 * Modern Login Page JavaScript - Vanilla JS (no jQuery)
 * Includes MD5 and SHA256 hashing functions from classic login.js
 */

// MD5 and SHA256 functions (from classic login.js)
(function () {
	function md5cycle(x, k) {
		var a = x[0],
			b = x[1],
			c = x[2],
			d = x[3];

		a = ff(a, b, c, d, k[0], 7, -680876936);
		d = ff(d, a, b, c, k[1], 12, -389564586);
		c = ff(c, d, a, b, k[2], 17, 606105819);
		b = ff(b, c, d, a, k[3], 22, -1044525330);
		a = ff(a, b, c, d, k[4], 7, -176418897);
		d = ff(d, a, b, c, k[5], 12, 1200080426);
		c = ff(c, d, a, b, k[6], 17, -1473231341);
		b = ff(b, c, d, a, k[7], 22, -45705983);
		a = ff(a, b, c, d, k[8], 7, 1770035416);
		d = ff(d, a, b, c, k[9], 12, -1958414417);
		c = ff(c, d, a, b, k[10], 17, -42063);
		b = ff(b, c, d, a, k[11], 22, -1990404162);
		a = ff(a, b, c, d, k[12], 7, 1804603682);
		d = ff(d, a, b, c, k[13], 12, -40341101);
		c = ff(c, d, a, b, k[14], 17, -1502002290);
		b = ff(b, c, d, a, k[15], 22, 1236535329);

		a = gg(a, b, c, d, k[1], 5, -165796510);
		d = gg(d, a, b, c, k[6], 9, -1069501632);
		c = gg(c, d, a, b, k[11], 14, 643717713);
		b = gg(b, c, d, a, k[0], 20, -373897302);
		a = gg(a, b, c, d, k[5], 5, -701558691);
		d = gg(d, a, b, c, k[10], 9, 38016083);
		c = gg(c, d, a, b, k[15], 14, -660478335);
		b = gg(b, c, d, a, k[4], 20, -405537848);
		a = gg(a, b, c, d, k[9], 5, 568446438);
		d = gg(d, a, b, c, k[14], 9, -1019803690);
		c = gg(c, d, a, b, k[3], 14, -187363961);
		b = gg(b, c, d, a, k[8], 20, 1163531501);
		a = gg(a, b, c, d, k[13], 5, -1444681467);
		d = gg(d, a, b, c, k[2], 9, -51403784);
		c = gg(c, d, a, b, k[7], 14, 1735328473);
		b = gg(b, c, d, a, k[12], 20, -1926607734);

		a = hh(a, b, c, d, k[5], 4, -378558);
		d = hh(d, a, b, c, k[8], 11, -2022574463);
		c = hh(c, d, a, b, k[11], 16, 1839030562);
		b = hh(b, c, d, a, k[14], 23, -35309556);
		a = hh(a, b, c, d, k[1], 4, -1530992060);
		d = hh(d, a, b, c, k[4], 11, 1272893353);
		c = hh(c, d, a, b, k[7], 16, -155497632);
		b = hh(b, c, d, a, k[10], 23, -1094730640);
		a = hh(a, b, c, d, k[13], 4, 681279174);
		d = hh(d, a, b, c, k[0], 11, -358537222);
		c = hh(c, d, a, b, k[3], 16, -722521979);
		b = hh(b, c, d, a, k[6], 23, 76029189);
		a = hh(a, b, c, d, k[9], 4, -640364487);
		d = hh(d, a, b, c, k[12], 11, -421815835);
		c = hh(c, d, a, b, k[15], 16, 530742520);
		b = hh(b, c, d, a, k[2], 23, -995338651);

		a = ii(a, b, c, d, k[0], 6, -198630844);
		d = ii(d, a, b, c, k[7], 10, 1126891415);
		c = ii(c, d, a, b, k[14], 15, -1416354905);
		b = ii(b, c, d, a, k[5], 21, -57434055);
		a = ii(a, b, c, d, k[12], 6, 1700485571);
		d = ii(d, a, b, c, k[3], 10, -1894986606);
		c = ii(c, d, a, b, k[10], 15, -1051523);
		b = ii(b, c, d, a, k[1], 21, -2054922799);
		a = ii(a, b, c, d, k[8], 6, 1873313359);
		d = ii(d, a, b, c, k[15], 10, -30611744);
		c = ii(c, d, a, b, k[6], 15, -1560198380);
		b = ii(b, c, d, a, k[13], 21, 1309151649);
		a = ii(a, b, c, d, k[4], 6, -145523070);
		d = ii(d, a, b, c, k[11], 10, -1120210379);
		c = ii(c, d, a, b, k[2], 15, 718787259);
		b = ii(b, c, d, a, k[9], 21, -343485551);

		x[0] = add32(a, x[0]);
		x[1] = add32(b, x[1]);
		x[2] = add32(c, x[2]);
		x[3] = add32(d, x[3]);
	}

	function cmn(q, a, b, x, s, t) {
		a = add32(add32(a, q), add32(x, t));
		return add32((a << s) | (a >>> (32 - s)), b);
	}

	function ff(a, b, c, d, x, s, t) {
		return cmn((b & c) | (~b & d), a, b, x, s, t);
	}

	function gg(a, b, c, d, x, s, t) {
		return cmn((b & d) | (c & ~d), a, b, x, s, t);
	}

	function hh(a, b, c, d, x, s, t) {
		return cmn(b ^ c ^ d, a, b, x, s, t);
	}

	function ii(a, b, c, d, x, s, t) {
		return cmn(c ^ (b | ~d), a, b, x, s, t);
	}

	function md51(s) {
		if (/[\x80-\xFF]/.test(s)) {
			s = unescape(encodeURI(s));
		}
		var n = s.length,
			state = [1732584193, -271733879, -1732584194, 271733878],
			i;
		for (i = 64; i <= s.length; i += 64) {
			md5cycle(state, md5blk(s.substring(i - 64, i)));
		}
		s = s.substring(i - 64);
		var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << (i % 4 << 3);
		tail[i >> 2] |= 0x80 << (i % 4 << 3);
		if (i > 55) {
			md5cycle(state, tail);
			for (i = 0; i < 16; i++) tail[i] = 0;
		}
		tail[14] = n * 8;
		md5cycle(state, tail);
		return state;
	}

	function md5blk(s) {
		var md5blks = [],
			i;
		for (i = 0; i < 64; i += 4) {
			md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
		}
		return md5blks;
	}

	var hex_chr = '0123456789abcdef'.split('');

	function rhex(n) {
		var s = '',
			j = 0;
		for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f];
		return s;
	}

	function hex(x) {
		for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]);
		return x.join('');
	}

	window.md5 = function (s) {
		return hex(md51(s));
	};

	function add32(a, b) {
		return (a + b) & 0xffffffff;
	}

	if (window.md5('hello') != '5d41402abc4b2a76b9719d911017c592') {
		window.md5 = function (s) {
			return hex(md51(s));
		};
		function add32(x, y) {
			var lsw = (x & 0xffff) + (y & 0xffff),
				msw = (x >> 16) + (y >> 16) + (lsw >> 16);
			return (msw << 16) | (lsw & 0xffff);
		}
	}
})();

function SHA256(s) {
	var chrsz = 8;
	var hexcase = 0;

	function safe_add(x, y) {
		var lsw = (x & 0xffff) + (y & 0xffff);
		var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
		return (msw << 16) | (lsw & 0xffff);
	}

	function S(X, n) {
		return (X >>> n) | (X << (32 - n));
	}
	function R(X, n) {
		return X >>> n;
	}
	function Ch(x, y, z) {
		return (x & y) ^ (~x & z);
	}
	function Maj(x, y, z) {
		return (x & y) ^ (x & z) ^ (y & z);
	}
	function Sigma0256(x) {
		return S(x, 2) ^ S(x, 13) ^ S(x, 22);
	}
	function Sigma1256(x) {
		return S(x, 6) ^ S(x, 11) ^ S(x, 25);
	}
	function Gamma0256(x) {
		return S(x, 7) ^ S(x, 18) ^ R(x, 3);
	}
	function Gamma1256(x) {
		return S(x, 17) ^ S(x, 19) ^ R(x, 10);
	}

	function core_sha256(m, l) {
		var K = [
			0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
			0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0xfc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
			0xc6e00bf3, 0xd5a79147, 0x6ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
			0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
			0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
		];
		var HASH = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
		var W = new Array(64);
		var a, b, c, d, e, f, g, h, i, j;
		var T1, T2;

		m[l >> 5] |= 0x80 << (24 - (l % 32));
		m[(((l + 64) >> 9) << 4) + 15] = l;

		for (var i = 0; i < m.length; i += 16) {
			a = HASH[0];
			b = HASH[1];
			c = HASH[2];
			d = HASH[3];
			e = HASH[4];
			f = HASH[5];
			g = HASH[6];
			h = HASH[7];

			for (var j = 0; j < 64; j++) {
				if (j < 16) W[j] = m[j + i];
				else W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);

				T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
				T2 = safe_add(Sigma0256(a), Maj(a, b, c));

				h = g;
				g = f;
				f = e;
				e = safe_add(d, T1);
				d = c;
				c = b;
				b = a;
				a = safe_add(T1, T2);
			}

			HASH[0] = safe_add(a, HASH[0]);
			HASH[1] = safe_add(b, HASH[1]);
			HASH[2] = safe_add(c, HASH[2]);
			HASH[3] = safe_add(d, HASH[3]);
			HASH[4] = safe_add(e, HASH[4]);
			HASH[5] = safe_add(f, HASH[5]);
			HASH[6] = safe_add(g, HASH[6]);
			HASH[7] = safe_add(h, HASH[7]);
		}
		return HASH;
	}

	function str2binb(str) {
		var bin = [];
		var mask = (1 << chrsz) - 1;
		for (var i = 0; i < str.length * chrsz; i += chrsz) {
			bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - (i % 32));
		}
		return bin;
	}

	function Utf8Encode(string) {
		var utftext = '';
		for (var n = 0; n < string.length; n++) {
			var c = string.charCodeAt(n);
			if (c < 128) {
				utftext += String.fromCharCode(c);
			} else if (c > 127 && c < 2048) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			} else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}
		}
		return utftext;
	}

	function binb2hex(binarray) {
		var hex_tab = hexcase ? '0123456789ABCDEF' : '0123456789abcdef';
		var str = '';
		for (var i = 0; i < binarray.length * 4; i++) {
			str += hex_tab.charAt((binarray[i >> 2] >> ((3 - (i % 4)) * 8 + 4)) & 0xf) + hex_tab.charAt((binarray[i >> 2] >> ((3 - (i % 4)) * 8)) & 0xf);
		}
		return str;
	}

	s = Utf8Encode(s);
	return binb2hex(core_sha256(str2binb(s), s.length * chrsz));
}

// Cookie management
function createCookie(cookie, value, days) {
	var newDate = new Date();
	var url = window.location.href;
	var match = url.match(/^(http|https|ftp)?(?:[\:\/]*)([a-z0-9\.-]*)(?:\:([0-9]+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i);
	var host = match[2];
	var server = /localhost/i.test(host) ? host : host.split('.').slice(1).join('.');

	if (days) {
		newDate.setTime(newDate.getTime() + days * 24 * 60 * 60 * 1000);
		var strExpires = '; expires=' + newDate.toGMTString();
	} else {
		var strExpires = '';
	}

	var domain = /localhost/i.test(server) ? '' : '; domain=' + server;
	document.cookie = cookie + '=' + value + domain + strExpires + '; path=/; ';
}

function getCookie(cookie) {
	var name = cookie + '=';
	var cookies = document.cookie.split(';');
	for (var i = 0; i < cookies.length; i++) {
		var valueCookie = cookies[i];
		while (valueCookie.charAt(0) == ' ') {
			valueCookie = valueCookie.substring(1, valueCookie.length);
		}
		if (valueCookie.indexOf(name) == 0) {
			return valueCookie.substring(name.length, valueCookie.length);
		}
	}
	return null;
}

function clearCookie(cookie) {
	createCookie(cookie, '', -1);
}

// Utility functions
function showPanel(panelId) {
	var panels = ['login-panel', 'reset-panel', 'reset-success-panel', 'otp-verify-email-panel', 'otp-verify-phone-panel'];
	panels.forEach(function (id) {
		var el = document.getElementById(id);
		if (el) {
			el.classList.add('hidden');
		}
	});
	var panel = document.getElementById(panelId);
	if (panel) {
		panel.classList.remove('hidden');
	}
}

function showError(elementId, message) {
	var errorEl = document.getElementById(elementId);
	if (errorEl) {
		errorEl.textContent = message;
		errorEl.classList.remove('hidden');
	}
}

function hideError(elementId) {
	var errorEl = document.getElementById(elementId);
	if (errorEl) {
		errorEl.classList.add('hidden');
	}
}

function showLoading() {
	var loadingEl = document.getElementById('loading-panel');
	if (loadingEl) {
		loadingEl.classList.remove('hidden');
	}
}

function hideLoading() {
	var loadingEl = document.getElementById('loading-panel');
	if (loadingEl) {
		loadingEl.classList.add('hidden');
	}
}

function getClientInfo() {
	var geolocation = null;
	var resolution = {
		width: screen.width,
		height: screen.height,
	};
	var fingerprint = window.fingerprint || null;
	var source = 'interface';
	return {
		geolocation: geolocation,
		resolution: resolution,
		fingerprint: fingerprint,
		source: source,
	};
}

function collectGeolocation(callback) {
	if (!navigator.geolocation) {
		callback(null);
		return;
	}
	var timeout = setTimeout(function () {
		callback(null);
	}, 8000);
	navigator.geolocation.getCurrentPosition(
		function (position) {
			clearTimeout(timeout);
			callback({
				longitude: position.coords.longitude,
				latitude: position.coords.latitude,
			});
		},
		function () {
			clearTimeout(timeout);
			callback(null);
		},
	);
}

// Main initialization
(function () {
	// Clear cookies
	clearCookie('_authTokenNs');
	clearCookie('_authTokenId');
	clearCookie('KonectyDomain');
	clearCookie('KonectyUser');
	clearCookie('KonectyNS');

	// Hide loading panel
	hideLoading();

	// Browser compatibility check
	var userAgent = navigator.userAgent.toLowerCase();
	var isChrome = /chrome/.test(userAgent) && !/edge/.test(userAgent);
	var isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
	var isFirefox = /firefox/.test(userAgent);
	if (!isChrome && !isSafari && !isFirefox) {
		var compatiblePanel = document.getElementById('compatible-panel');
		if (compatiblePanel) {
			compatiblePanel.classList.remove('hidden');
		}
		return;
	}

	// Show login panel
	showPanel('login-panel');

	// Restore saved username
	var savedUser = getCookie('KonectyUser');
	if (savedUser) {
		var userInput = document.getElementById('login-user');
		if (userInput) {
			userInput.value = savedUser;
		}
	}

	// Focus first input
	var firstInput = document.querySelector('#login-panel input');
	if (firstInput) {
		firstInput.focus();
	}

	var namespaceEl = document.getElementById('namespace');
	var namespace = namespaceEl ? namespaceEl.value : '';

	// Traditional login form
	var loginForm = document.getElementById('login-form');
	if (loginForm) {
		loginForm.addEventListener('submit', function (e) {
			e.preventDefault();
			hideError('login-error');

			var userInput = document.getElementById('login-user');
			var passwordInput = document.getElementById('login-password');
			var user = userInput ? userInput.value.trim() : '';
			var password = passwordInput ? passwordInput.value.trim() : '';

			if (!user || !password) {
				if (!user) {
					userInput.focus();
				} else {
					passwordInput.focus();
				}
				return;
			}

			showLoading();

			collectGeolocation(function (geolocation) {
				var clientInfo = getClientInfo();
				clientInfo.geolocation = geolocation;

				fetch('/rest/auth/login', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						user: user,
						password: window.md5(password),
						password_SHA256: SHA256(password),
						ns: namespace.replace(/[\s-]/g, ''),
						geolocation: clientInfo.geolocation ? JSON.stringify(clientInfo.geolocation) : null,
						resolution: JSON.stringify(clientInfo.resolution),
						fingerprint: clientInfo.fingerprint,
						source: clientInfo.source,
					}),
				})
					.then(function (response) {
						return response.json().then(function (data) {
							return { status: response.status, data: data };
						});
					})
					.then(function (result) {
						hideLoading();
						if (result.status === 200) {
							var duration = (result.data.cookieMaxAge || 2592000) / (24 * 60 * 60);
							createCookie('KonectyNS', namespace.replace(/[\s-]/g, ''), 365);
							createCookie('KonectyUser', user, 365);
							createCookie('_authTokenNs', namespace.replace(/[\s-]/g, ''), duration);
							createCookie('_authTokenId', result.data.authId, duration);
							window.location.href = window.location.origin;
						} else {
							showPanel('login-panel');
							var errorMsg = result.data.errors && result.data.errors[0] && result.data.errors[0].message ? result.data.errors[0].message : 'Login failed';
							showError('login-error', errorMsg);
							userInput.focus();
						}
					})
					.catch(function (error) {
						hideLoading();
						showPanel('login-panel');
						showError('login-error', 'An error occurred. Please try again.');
						console.error('Login error:', error);
					});
			});
		});
	}

	// Forgot password link
	var forgotPasswordLink = document.getElementById('forgot-password-link');
	if (forgotPasswordLink) {
		forgotPasswordLink.addEventListener('click', function (e) {
			e.preventDefault();
			showPanel('reset-panel');
			var resetUserInput = document.getElementById('reset-user');
			if (resetUserInput) {
				resetUserInput.focus();
			}
		});
	}

	// Cancel reset link
	var cancelResetLink = document.getElementById('cancel-reset-link');
	if (cancelResetLink) {
		cancelResetLink.addEventListener('click', function (e) {
			e.preventDefault();
			showPanel('login-panel');
			var userInput = document.getElementById('login-user');
			if (userInput) {
				userInput.focus();
			}
		});
	}

	// Reset password form
	var resetForm = document.getElementById('reset-form');
	if (resetForm) {
		resetForm.addEventListener('submit', function (e) {
			e.preventDefault();
			hideError('reset-error');

			var resetUserInput = document.getElementById('reset-user');
			var user = resetUserInput ? resetUserInput.value.trim() : '';

			if (!user) {
				resetUserInput.focus();
				return;
			}

			showLoading();

			fetch('/rest/auth/reset', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					ns: namespace.replace(/[\s-]/g, ''),
					user: user,
				}),
			})
				.then(function (response) {
					return response.json();
				})
				.then(function (data) {
					hideLoading();
					if (data.errors && data.errors.length > 0 && data.errors[0].message) {
						showPanel('reset-panel');
						showError('reset-error', data.errors[0].message);
						resetUserInput.focus();
					} else {
						showPanel('reset-success-panel');
					}
				})
				.catch(function (error) {
					hideLoading();
					showPanel('reset-panel');
					showError('reset-error', 'An error occurred. Please try again.');
					console.error('Reset error:', error);
				});
		});
	}

	// OTP Email form
	var otpEmailForm = document.getElementById('otp-email-form');
	if (otpEmailForm) {
		otpEmailForm.addEventListener('submit', function (e) {
			e.preventDefault();
			hideError('otp-email-error');

			var emailInput = document.getElementById('otp-email');
			var email = emailInput ? emailInput.value.trim() : '';

			if (!email) {
				emailInput.focus();
				return;
			}

			showLoading();

			collectGeolocation(function (geolocation) {
				var clientInfo = getClientInfo();
				clientInfo.geolocation = geolocation;

				fetch('/api/auth/request-otp', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						email: email,
						geolocation: clientInfo.geolocation,
						resolution: clientInfo.resolution,
						fingerprint: clientInfo.fingerprint,
						source: clientInfo.source,
					}),
				})
					.then(function (response) {
						return response.json().then(function (data) {
							return { status: response.status, data: data };
						});
					})
					.then(function (result) {
						hideLoading();
						if (result.status === 200) {
							var verifyPanel = document.getElementById('otp-verify-email-panel');
							if (verifyPanel) {
								verifyPanel.classList.remove('hidden');
							}
							var otpCodeInput = document.getElementById('otp-code-email');
							if (otpCodeInput) {
								otpCodeInput.focus();
							}
						} else {
							var errorMsg = result.data.message || result.data.error || 'Failed to send OTP';
							showError('otp-email-error', errorMsg);
						}
					})
					.catch(function (error) {
						hideLoading();
						showError('otp-email-error', 'An error occurred. Please try again.');
						console.error('OTP email error:', error);
					});
			});
		});
	}

	// OTP Verify Email form
	var otpVerifyEmailForm = document.getElementById('otp-verify-email-form');
	if (otpVerifyEmailForm) {
		otpVerifyEmailForm.addEventListener('submit', function (e) {
			e.preventDefault();
			hideError('otp-verify-email-error');

			var emailInput = document.getElementById('otp-email');
			var otpCodeInput = document.getElementById('otp-code-email');
			var email = emailInput ? emailInput.value.trim() : '';
			var otpCode = otpCodeInput ? otpCodeInput.value.trim() : '';

			if (!otpCode || otpCode.length !== 6) {
				otpCodeInput.focus();
				return;
			}

			showLoading();

			collectGeolocation(function (geolocation) {
				var clientInfo = getClientInfo();
				clientInfo.geolocation = geolocation;

				fetch('/api/auth/verify-otp', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						email: email,
						otpCode: otpCode,
						geolocation: clientInfo.geolocation,
						resolution: clientInfo.resolution,
						fingerprint: clientInfo.fingerprint,
						source: clientInfo.source,
					}),
				})
					.then(function (response) {
						return response.json().then(function (data) {
							return { status: response.status, data: data };
						});
					})
					.then(function (result) {
						hideLoading();
						if (result.status === 200) {
							var duration = (result.data.cookieMaxAge || 2592000) / (24 * 60 * 60);
							createCookie('KonectyNS', namespace.replace(/[\s-]/g, ''), 365);
							createCookie('KonectyUser', email, 365);
							createCookie('_authTokenNs', namespace.replace(/[\s-]/g, ''), duration);
							createCookie('_authTokenId', result.data.authId, duration);
							window.location.href = window.location.origin;
						} else {
							var errorMsg = result.data.message || result.data.error || 'Invalid OTP code';
							showError('otp-verify-email-error', errorMsg);
							otpCodeInput.focus();
						}
					})
					.catch(function (error) {
						hideLoading();
						showError('otp-verify-email-error', 'An error occurred. Please try again.');
						console.error('OTP verify email error:', error);
					});
			});
		});
	}

	// Initialize country dropdown
	function initializeCountryDropdown() {
		var countrySelect = document.getElementById('otp-phone-country');
		if (!countrySelect) {
			return;
		}

		// libphonenumber-js CDN exposes as libphonenumber_js
		const lib = typeof libphonenumber_js !== 'undefined' ? libphonenumber_js : (typeof libphonenumber !== 'undefined' ? libphonenumber : null);
		
		// If library not available, populate with basic countries
		if (!lib || typeof window.CountryCodes === 'undefined') {
			// Fallback: add basic countries manually
			var basicCountries = [
				{ code: 'BR', flag: '🇧🇷', callingCode: '55' },
				{ code: 'US', flag: '🇺🇸', callingCode: '1' },
				{ code: 'AR', flag: '🇦🇷', callingCode: '54' },
				{ code: 'CL', flag: '🇨🇱', callingCode: '56' },
				{ code: 'CO', flag: '🇨🇴', callingCode: '57' },
				{ code: 'MX', flag: '🇲🇽', callingCode: '52' },
				{ code: 'PT', flag: '🇵🇹', callingCode: '351' },
				{ code: 'ES', flag: '🇪🇸', callingCode: '34' },
				{ code: 'IT', flag: '🇮🇹', callingCode: '39' },
			];
			
			var defaultCountry = countrySelect.getAttribute('data-default-country') || 'BR';
			
			basicCountries.forEach(function (country) {
				var option = document.createElement('option');
				option.value = country.code;
				option.textContent = country.flag + ' +' + country.callingCode;
				option.setAttribute('data-calling-code', country.callingCode);
				if (country.code === defaultCountry) {
					option.selected = true;
				}
				countrySelect.appendChild(option);
			});
			
			updatePhoneInputPlaceholder();
			return;
		}

		// Get default country from data attribute or locale
		var defaultCountry = countrySelect.getAttribute('data-default-country') || 'BR';
		if (window.CountryCodes && window.CountryCodes.getDefaultCountry) {
			var htmlLang = document.documentElement.lang || '';
			defaultCountry = window.CountryCodes.getDefaultCountry(htmlLang) || defaultCountry;
		}

		// Get country list
		var countryList = [];
		if (window.CountryCodes && window.CountryCodes.getCountryList) {
			countryList = window.CountryCodes.getCountryList();
		}

		// Clear existing options
		countrySelect.innerHTML = '';

		// Populate dropdown
		countryList.forEach(function (country) {
			var option = document.createElement('option');
			option.value = country.code;
			option.textContent = country.flag + ' +' + country.callingCode;
			option.setAttribute('data-calling-code', country.callingCode);
			if (country.code === defaultCountry) {
				option.selected = true;
			}
			countrySelect.appendChild(option);
		});

		// Update phone input placeholder based on selected country
		updatePhoneInputPlaceholder();
	}

	// Update phone input placeholder based on selected country
	function updatePhoneInputPlaceholder() {
		var countrySelect = document.getElementById('otp-phone-country');
		var phoneInput = document.getElementById('otp-phone');
		if (!countrySelect || !phoneInput) {
			return;
		}

		var selectedOption = countrySelect.options[countrySelect.selectedIndex];
		if (selectedOption && selectedOption.value) {
			var callingCode = selectedOption.getAttribute('data-calling-code') || '';
			// Set placeholder based on country (Brazil: 11 digits, US: 10 digits, etc.)
			if (selectedOption.value === 'BR') {
				phoneInput.placeholder = '11999999999';
			} else if (selectedOption.value === 'US') {
				phoneInput.placeholder = '2025551234';
			} else {
				phoneInput.placeholder = '999999999';
			}
		}
	}

	// Initialize country dropdown when DOM is ready
	// Use DOMContentLoaded or immediate if already loaded
	(function initCountryDropdown() {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', initializeCountryDropdown);
		} else {
			// DOM already loaded, initialize immediately
			initializeCountryDropdown();
		}
	})();

	// OTP Phone form
	var otpPhoneForm = document.getElementById('otp-phone-form');
	if (otpPhoneForm) {
		// Handle country selection change
		var countrySelect = document.getElementById('otp-phone-country');
		if (countrySelect) {
			countrySelect.addEventListener('change', updatePhoneInputPlaceholder);
		}

		otpPhoneForm.addEventListener('submit', function (e) {
			e.preventDefault();
			hideError('otp-phone-error');

			var countrySelect = document.getElementById('otp-phone-country');
			var phoneInput = document.getElementById('otp-phone');
			var countryCode = countrySelect ? countrySelect.value : '';
			var phoneNumber = phoneInput ? phoneInput.value.trim() : '';

			if (!countryCode) {
				showError('otp-phone-error', 'Please select a country');
				if (countrySelect) countrySelect.focus();
				return;
			}

			if (!phoneNumber) {
				if (phoneInput) phoneInput.focus();
				return;
			}

			// Combine country code and phone number to E.164 format
			var fullPhoneNumber = '';
			if (window.CountryCodes && window.CountryCodes.combineToE164) {
				fullPhoneNumber = window.CountryCodes.combineToE164(countryCode, phoneNumber);
			} else {
				// Fallback: manual combination
				var selectedOption = countrySelect.options[countrySelect.selectedIndex];
				var callingCode = selectedOption ? selectedOption.getAttribute('data-calling-code') : '';
				if (callingCode) {
					fullPhoneNumber = '+' + callingCode + phoneNumber.replace(/^0+/, '');
				}
			}

			if (!fullPhoneNumber) {
				showError('otp-phone-error', 'Invalid phone number format');
				return;
			}

			// Validate phone number by country
			if (window.CountryCodes && window.CountryCodes.validatePhoneNumberByCountry) {
				var isValid = window.CountryCodes.validatePhoneNumberByCountry(fullPhoneNumber, countryCode);
				if (!isValid) {
					showError('otp-phone-error', 'Invalid phone number for selected country');
					return;
				}
			}

			showLoading();

			collectGeolocation(function (geolocation) {
				var clientInfo = getClientInfo();
				clientInfo.geolocation = geolocation;

				fetch('/api/auth/request-otp', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						phoneNumber: fullPhoneNumber,
						geolocation: clientInfo.geolocation,
						resolution: clientInfo.resolution,
						fingerprint: clientInfo.fingerprint,
						source: clientInfo.source,
					}),
				})
					.then(function (response) {
						return response.json().then(function (data) {
							return { status: response.status, data: data };
						});
					})
					.then(function (result) {
						hideLoading();
						if (result.status === 200) {
							var verifyPanel = document.getElementById('otp-verify-phone-panel');
							if (verifyPanel) {
								verifyPanel.classList.remove('hidden');
							}
							var otpCodeInput = document.getElementById('otp-code-phone');
							if (otpCodeInput) {
								otpCodeInput.focus();
							}
						} else {
							var errorMsg = result.data.message || result.data.error || 'Failed to send OTP';
							showError('otp-phone-error', errorMsg);
						}
					})
					.catch(function (error) {
						hideLoading();
						showError('otp-phone-error', 'An error occurred. Please try again.');
						console.error('OTP phone error:', error);
					});
			});
		});
	}

	// OTP Verify Phone form
	var otpVerifyPhoneForm = document.getElementById('otp-verify-phone-form');
	if (otpVerifyPhoneForm) {
		otpVerifyPhoneForm.addEventListener('submit', function (e) {
			e.preventDefault();
			hideError('otp-verify-phone-error');

			var countrySelect = document.getElementById('otp-phone-country');
			var phoneInput = document.getElementById('otp-phone');
			var otpCodeInput = document.getElementById('otp-code-phone');
			var countryCode = countrySelect ? countrySelect.value : '';
			var phoneNumber = phoneInput ? phoneInput.value.trim() : '';
			var otpCode = otpCodeInput ? otpCodeInput.value.trim() : '';

			// Combine country code and phone number to E.164 format (same as in request)
			var fullPhoneNumber = '';
			if (countryCode && phoneNumber) {
				if (window.CountryCodes && window.CountryCodes.combineToE164) {
					fullPhoneNumber = window.CountryCodes.combineToE164(countryCode, phoneNumber);
				} else {
					// Fallback
					var selectedOption = countrySelect ? countrySelect.options[countrySelect.selectedIndex] : null;
					var callingCode = selectedOption ? selectedOption.getAttribute('data-calling-code') : '';
					if (callingCode) {
						fullPhoneNumber = '+' + callingCode + phoneNumber.replace(/^0+/, '');
					}
				}
			}

			if (!otpCode || otpCode.length !== 6) {
				otpCodeInput.focus();
				return;
			}

			showLoading();

			collectGeolocation(function (geolocation) {
				var clientInfo = getClientInfo();
				clientInfo.geolocation = geolocation;

				fetch('/api/auth/verify-otp', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				body: JSON.stringify({
					phoneNumber: fullPhoneNumber || phoneNumber,
					otpCode: otpCode,
					geolocation: clientInfo.geolocation,
					resolution: clientInfo.resolution,
					fingerprint: clientInfo.fingerprint,
					source: clientInfo.source,
				}),
				})
					.then(function (response) {
						return response.json().then(function (data) {
							return { status: response.status, data: data };
						});
					})
					.then(function (result) {
						hideLoading();
						if (result.status === 200) {
							var duration = (result.data.cookieMaxAge || 2592000) / (24 * 60 * 60);
							createCookie('KonectyNS', namespace.replace(/[\s-]/g, ''), 365);
							createCookie('KonectyUser', fullPhoneNumber || phoneNumber, 365);
							createCookie('_authTokenNs', namespace.replace(/[\s-]/g, ''), duration);
							createCookie('_authTokenId', result.data.authId, duration);
							window.location.href = window.location.origin;
						} else {
							var errorMsg = result.data.message || result.data.error || 'Invalid OTP code';
							showError('otp-verify-phone-error', errorMsg);
							otpCodeInput.focus();
						}
					})
					.catch(function (error) {
						hideLoading();
						showError('otp-verify-phone-error', 'An error occurred. Please try again.');
						console.error('OTP verify phone error:', error);
					});
			});
		});
	}

	// Modal Management Functions
	function openModal(modalId) {
		const modal = document.getElementById(modalId);
		if (modal) {
			modal.classList.remove('hidden');
			document.body.style.overflow = 'hidden';
		}
	}

	function closeModal(modalId) {
		const modal = document.getElementById(modalId);
		if (modal) {
			modal.classList.add('hidden');
			document.body.style.overflow = 'unset';
			// Reset forms and panels when closing
			if (modalId === 'email-otp-modal') {
				const form = document.getElementById('otp-email-form');
				const verifyPanel = document.getElementById('otp-verify-email-panel');
				if (form) form.reset();
				if (verifyPanel) verifyPanel.classList.add('hidden');
				hideError('otp-email-error');
				hideError('otp-verify-email-error');
			} else if (modalId === 'whatsapp-otp-modal') {
				const form = document.getElementById('otp-phone-form');
				const verifyPanel = document.getElementById('otp-verify-phone-panel');
				if (form) form.reset();
				if (verifyPanel) verifyPanel.classList.add('hidden');
				hideError('otp-phone-error');
				hideError('otp-verify-phone-error');
				// Re-initialize country dropdown after reset if empty
				if (document.getElementById('otp-phone-country') && document.getElementById('otp-phone-country').options.length === 0) {
					initializeCountryDropdown();
				}
			}
		}
	}

	// Open Email OTP Modal
	const openEmailModalBtn = document.getElementById('open-email-otp-modal');
	if (openEmailModalBtn) {
		openEmailModalBtn.addEventListener('click', function () {
			openModal('email-otp-modal');
		});
	}

	// Close Email OTP Modal
	const closeEmailModalBtn = document.getElementById('close-email-otp-modal');
	const emailModalBackdrop = document.getElementById('email-otp-modal-backdrop');
	if (closeEmailModalBtn) {
		closeEmailModalBtn.addEventListener('click', function () {
			closeModal('email-otp-modal');
		});
	}
	if (emailModalBackdrop) {
		emailModalBackdrop.addEventListener('click', function () {
			closeModal('email-otp-modal');
		});
	}

	// Open WhatsApp OTP Modal
	const openWhatsappModalBtn = document.getElementById('open-whatsapp-otp-modal');
	if (openWhatsappModalBtn) {
		openWhatsappModalBtn.addEventListener('click', function () {
			openModal('whatsapp-otp-modal');
			// Re-initialize if needed (in case libphonenumber loaded after initial init)
			if (document.getElementById('otp-phone-country') && document.getElementById('otp-phone-country').options.length === 0) {
				initializeCountryDropdown();
			}
		});
	}

	// Close WhatsApp OTP Modal
	const closeWhatsappModalBtn = document.getElementById('close-whatsapp-otp-modal');
	const whatsappModalBackdrop = document.getElementById('whatsapp-otp-modal-backdrop');
	if (closeWhatsappModalBtn) {
		closeWhatsappModalBtn.addEventListener('click', function () {
			closeModal('whatsapp-otp-modal');
		});
	}
	if (whatsappModalBackdrop) {
		whatsappModalBackdrop.addEventListener('click', function () {
			closeModal('whatsapp-otp-modal');
		});
	}

	// Close modals on ESC key
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') {
			const emailModal = document.getElementById('email-otp-modal');
			const whatsappModal = document.getElementById('whatsapp-otp-modal');
			if (emailModal && !emailModal.classList.contains('hidden')) {
				closeModal('email-otp-modal');
			}
			if (whatsappModal && !whatsappModal.classList.contains('hidden')) {
				closeModal('whatsapp-otp-modal');
			}
		}
	});
})();

