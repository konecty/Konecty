UI.registerHelper('arrayify', function(obj) {
	const result = [];
	for (let key in obj) {
		const value = obj[key];
		result.push({ 
			key,
			value
		});
	}

	return result;
});