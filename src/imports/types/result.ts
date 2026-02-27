export type KonectyError = {
	message: string;
	code?: string | number;
	details?: string;
};

/** Used by scripts (e.g. scriptBeforeValidation) to enqueue emails to send */
export type EmailToSend = {
	to?: string;
	subject?: string;
	body?: string;
	[key: string]: unknown;
};

export type KonectyResult<T = unknown> = KonectyResultSuccess<T> | KonectyResultError;

export type KonectyResultSuccess<T = unknown> = {
	success: true;
	data: T;
	total?: number;
};

export type KonectyResultError = {
	success: false;
	errors: Array<KonectyError>;
};
