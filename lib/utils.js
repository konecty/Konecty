/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
(this.utils == null) && (this.utils = {});

!(this.utils.accentsTidy = function(s) {
	if (!_.isString(s)) { return ''; }
	let r = s.toLowerCase();
	r = r.replace(/\s/g      ,"");
	r = r.replace(/[àáâãäå]/g,"a");
	r = r.replace(/æ/g       ,"ae");
	r = r.replace(/ç/g       ,"c");
	r = r.replace(/[èéêë]/g  ,"e");
	r = r.replace(/[ìíîï]/g  ,"i");
	r = r.replace(/ñ/g       ,"n");
	r = r.replace(/[òóôõö]/g ,"o");
	r = r.replace(/œ/g       ,"oe");
	r = r.replace(/[ùúûü]/g  ,"u");
	r = r.replace(/[ýÿ]/g    ,"y");
	return r;
});

!(this.utils.unicodeSortArrayOfObjectsByParam = (arr, param) =>
	arr.sort(function(a, b) {
		if (a[param] != null) {
			return utils.accentsTidy(a[param]).localeCompare(utils.accentsTidy(b[param]));
		}
		return 0;
	})
);

!(this.utils.sortArrayOfObjectsByParam = (arr, param) =>
	arr.sort(function(a, b) {
		if (a[param] != null) {
			return a[param].localeCompare(b[param]);
		}
		return 0;
	})
);
