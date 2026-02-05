(function () {
	if (window.localStorage) {
		const MAX_FP_AGE = 10 * 24 * 60 * 60 * 1000; // 10 days
		window.fingerprint = localStorage.getItem('_k.fp');

		if (window.fingerprint) {
			var fpDate = localStorage.getItem('_k.fp.date');

			if (fpDate && Date.now() - Number(fpDate) > MAX_FP_AGE) {
				localStorage.removeItem('_k.fp');
				localStorage.removeItem('_k.fp.date');
				window.fingerprint = null;
			}
		}

		if (!window.fingerprint) {
			const fpPromise = window.FingerprintJS.load();

			fpPromise
				.then(fp => fp.get())
				.then(result => {
					window.fingerprint = result.visitorId;
					localStorage.setItem('_k.fp', result.visitorId);
					localStorage.setItem('_k.fp.date', new Date().getTime().toString());
				});
		}
	}
})();
