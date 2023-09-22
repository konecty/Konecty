export const successReturn = function (value) {
	if (value == null) {
		return {
			success: true,
		};
	}
	return {
		success: true,
		data: value,
	};
};

export const errorReturn = function (messages) {
	if (Array.isArray(messages)) {
		return {
			success: false,
			errors: messages.map(message => ({
				message: message.message ?? message,
			})),
		};
	}
	return {
		success: false,
		errors: [
			{
				message: messages,
			},
		],
	};
};
