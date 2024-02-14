
/**
 * 
 * @param {any} value 
 * @returns {{success: true, data: any}}
 */
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

/**
 * 
 * @param {string | string[]} messages 
 * @returns {{success: false, errors: import("../types/result").KonectyError[]}}
 */
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
