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
 * @param {string | string[] | {message: string, code?: string | number, details?: string}[]} messages
 * @returns {{success: false, errors: import("../types/result").KonectyError[]}}
 */
export const errorReturn = function (messages) {
	if (Array.isArray(messages)) {
		return {
			success: false,
			errors: messages.map(message => {
				if (typeof message === 'string') {
					return { message };
				}
				return {
					message: message.message ?? message,
					code: message.code,
					details: message.details,
				};
			}),
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
