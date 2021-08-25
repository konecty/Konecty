const notify = (type, message, options) => {
	if (type instanceof Error && options === null) {
		options = message;
		message = type;
		type = 'undefined';
	}

	options = options || {};

	const reportError = new Error(type);
	const reportOptions = {
		...options,
		errorName: `[${process.env.dbName}] ${type}`,
		metadata: {
			...options.metadata,
			errorDetails: message.toString(),
		},
	};

	console.error(`Konecty error ${type}:\n${JSON.stringify(reportError)}\n===== Options:\n${JSON.stringify(reportOptions)}`);
};

export { notify };
