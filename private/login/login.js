/*!
 * Joseph Myer's md5() algorithm wrapped in a self-invoked function to prevent
 * global namespace polution, modified to hash unicode characters as UTF-8.
 *
 * Copyright 1999-2010, Joseph Myers, Paul Johnston, Greg Holt, Will Bond <will@wbond.net>
 * http://www.myersdaily.org/joseph/javascript/md5-text.html
 * http://pajhome.org.uk/crypt/md5
 *
 * Released under the BSD license
 * http://www.opensource.org/licenses/bsd-license
 */
(function() {
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
		// Converts the string to UTF-8 "bytes" when necessary
		if (/[\x80-\xFF]/.test(s)) {
			s = unescape(encodeURI(s));
		}
		txt = '';
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
		/* I figured global was faster.   */
		var md5blks = [],
			i; /* Andy King said do it this way. */
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

	md5 = function(s) {
		return hex(md51(s));
	};

	/* this function is much faster, so if possible we use it. Some IEs are the
	only ones I know of that need the idiotic second function, generated by an
	if clause.  */
	function add32(a, b) {
		return (a + b) & 0xffffffff;
	}

	if (md5('hello') != '5d41402abc4b2a76b9719d911017c592') {
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
		var K = new Array(
			0x428a2f98,
			0x71374491,
			0xb5c0fbcf,
			0xe9b5dba5,
			0x3956c25b,
			0x59f111f1,
			0x923f82a4,
			0xab1c5ed5,
			0xd807aa98,
			0x12835b01,
			0x243185be,
			0x550c7dc3,
			0x72be5d74,
			0x80deb1fe,
			0x9bdc06a7,
			0xc19bf174,
			0xe49b69c1,
			0xefbe4786,
			0xfc19dc6,
			0x240ca1cc,
			0x2de92c6f,
			0x4a7484aa,
			0x5cb0a9dc,
			0x76f988da,
			0x983e5152,
			0xa831c66d,
			0xb00327c8,
			0xbf597fc7,
			0xc6e00bf3,
			0xd5a79147,
			0x6ca6351,
			0x14292967,
			0x27b70a85,
			0x2e1b2138,
			0x4d2c6dfc,
			0x53380d13,
			0x650a7354,
			0x766a0abb,
			0x81c2c92e,
			0x92722c85,
			0xa2bfe8a1,
			0xa81a664b,
			0xc24b8b70,
			0xc76c51a3,
			0xd192e819,
			0xd6990624,
			0xf40e3585,
			0x106aa070,
			0x19a4c116,
			0x1e376c08,
			0x2748774c,
			0x34b0bcb5,
			0x391c0cb3,
			0x4ed8aa4a,
			0x5b9cca4f,
			0x682e6ff3,
			0x748f82ee,
			0x78a5636f,
			0x84c87814,
			0x8cc70208,
			0x90befffa,
			0xa4506ceb,
			0xbef9a3f7,
			0xc67178f2
		);
		var HASH = new Array(0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19);
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
		var bin = Array();
		var mask = (1 << chrsz) - 1;
		for (var i = 0; i < str.length * chrsz; i += chrsz) {
			bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - (i % 32));
		}
		return bin;
	}

	function Utf8Encode(string) {
		// METEOR change:
		// The webtoolkit.info version of this code added this
		// Utf8Encode function (which does seem necessary for dealing
		// with arbitrary Unicode), but the following line seems
		// problematic:
		//
		// string = string.replace(/\r\n/g,"\n");
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
			str +=
				hex_tab.charAt((binarray[i >> 2] >> ((3 - (i % 4)) * 8 + 4)) & 0xf) +
				hex_tab.charAt((binarray[i >> 2] >> ((3 - (i % 4)) * 8)) & 0xf);
		}
		return str;
	}

	s = Utf8Encode(s);
	return binb2hex(core_sha256(str2binb(s), s.length * chrsz));
}

function createCookie(cookie, value, days, clearMyKonecty) {
	var newDate = new Date();
	var url = window.location.href;
	var match = url.match(/^(http|https|ftp)?(?:[\:\/]*)([a-z0-9\.-]*)(?:\:([0-9]+))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i);
	var host = match[2];
	if (/localhost/i.test(host)) {
		var server = host;
	} else {
		var server = host
			.split('.')
			.slice(1)
			.join('.');
	}

	if (days) {
		newDate.setTime(newDate.getTime() + days * 24 * 60 * 60 * 1000);
		var strExpires = '; expires=' + newDate.toGMTString();
	} else {
		var strExpires = '';
	}

	if (/localhost/i.test(server)) {
		var domain = '';
	} else {
		var domain = '; domain=.' + server;
	}
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

function clearCookie(cookie, clearMyKonecty) {
	createCookie(cookie, '', -1, clearMyKonecty);
}

(function() {
	var input = document.createElement('input');
	if (typeof input.placeholder === 'undefined') {
		$('label').removeClass('hidden');
	}

	clearCookie('_authTokenNs', true);
	clearCookie('_authTokenId', true);
	clearCookie('KonectyDomain', true);
	clearCookie('KonectyUser', true);
	clearCookie('KonectyNS', true);

	$('.loading-panel').hide();

	if (!($.browser.chrome === true || $.browser.safari === true || $.browser.mozilla === true)) {
		return $('.compatible-panel').show();
	}

	if (getCookie('KonectyUser')) {
		$('#login').val(getCookie('KonectyUser'));
	}

	$('.login-panel').show();
	$('.login-panel')
		.find('input:first')
		.focus();

	$('.forgot-password').click(function(e) {
		$('.login-panel').hide();
		$('.reset-panel').show();
		$('.reset-panel')
			.find('input:first')
			.focus();

		return false;
	});

	$('.cancel-forgot-password').click(function() {
		$('.login-panel').show();
		$('.reset-panel').hide();
		$('.login-panel')
			.find('input:first')
			.focus();

		return false;
	});

	$('.login-panel form').submit(function() {
		$('.login-panel .alert-danger').addClass('hidden');

		if (
			$('#login')
				.val()
				.trim() === ''
		) {
			$('#login').focus();
			return false;
		}

		if (
			$('#password')
				.val()
				.trim() === ''
		) {
			$('#password').focus();
			return false;
		}

		$('.login-panel').hide();
		$('.loading-panel').show();

		var continueLogin = function(position) {
			var geolocation;

			if (position) {
				geolocation = JSON.stringify({
					lat: position.coords.latitude,
					lng: position.coords.longitude
				});
			}

			createCookie(
				'_authTokenNs',
				$('#namespace')
					.val()
					.replace(/[\s-]/g, ''),
				365
			);

			$.ajax({
				url: '/rest/auth/login',
				dataType: 'json',
				type: 'POST',
				data: {
					user: $('#login')
						.val()
						.trim(),
					password: md5(
						$('#password')
							.val()
							.trim()
					),
					password_SHA256: SHA256(
						$('#password')
							.val()
							.trim()
					),
					ns: $('#namespace')
						.val()
						.replace(/[\s-]/g, ''),
					geolocation: geolocation,
					resolution: JSON.stringify({
						height: screen.height,
						width: screen.width
					})
				},
				complete: function(r) {
					if (r.status === 200) {
						var data = JSON.parse(r.responseText);
						var duration = (data.cookieMaxAge || 2592000) / (24 * 60 * 60);
						createCookie(
							'KonectyNS',
							$('#namespace')
								.val()
								.replace(/[\s-]/g, ''),
							365
						);
						createCookie('KonectyUser', $('#login').val(), 365);
						createCookie(
							'_authTokenNs',
							$('#namespace')
								.val()
								.replace(/[\s-]/g, ''),
							duration
						);
						createCookie('_authTokenId', data.authId, duration);
						location.href = location.origin;
					} else {
						$('.loading-panel').hide();
						$('.login-panel').show();
						$('.login-panel')
							.find('input:first')
							.focus();
						var json = JSON.parse(r.responseText);
						$('.login-panel .alert-danger').html(json.errors[0].errors[0].msg);
						$('.login-panel .alert-danger').removeClass('hidden');
					}
				}
			});
		};

		var timeout = setTimeout(function() {
			continueLogin();
		}, 8000);

		window.navigator.geolocation.getCurrentPosition(continueLogin, function() {
			// $( '.loading-panel' ).hide();

			clearTimeout(timeout);
			continueLogin();

			// if ( $.browser.chrome === true ) {
			// 	$( '.geolocation-denied-chrome-panel' ).show();
			// }
			// else if ( $.browser.safari === true ) {
			// 	$( '.geolocation-denied-safari-panel' ).show();
			// }
			// else if ( $.browser.mozilla === true ) {
			// 	$( '.geolocation-denied-mozilla-panel' ).show();
			// }
		});

		return false;
	});

	$('.reset-panel form').submit(function() {
		$('.reset-panel .alert-danger').addClass('hidden');

		if (
			$('#reset-login')
				.val()
				.trim() === ''
		) {
			$('#reset-login').focus();
			return false;
		}

		$('.reset-panel').hide();
		$('.loading-panel').show();

		$.ajax({
			url: '/rest/auth/reset',
			type: 'POST',
			dataType: 'json',
			data: {
				ns: $('#namespace')
					.val()
					.replace(/[\s-]/g, ''),
				user: $('#reset-login').val()
			},
			complete: function(r) {
				var json = JSON.parse(r.responseText);

				if (
					json &&
					json.errors &&
					json.errors.length > 0 &&
					json.errors[0].errors &&
					json.errors[0].errors.length > 0 &&
					json.errors[0].errors[0].msg
				) {
					$('.loading-panel').hide();
					$('.reset-panel').show();
					$('.reset-panel')
						.find('input:first')
						.focus();
					$('.reset-panel .alert-danger').html(json.errors[0].errors[0].msg);
					$('.reset-panel .alert-danger').removeClass('hidden');
					return;
				}

				$('.loading-panel').hide();
				$('.reset-panel-success').show();
			}
		});

		return false;
	});
})();
