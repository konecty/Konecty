export type KonectyError = {
	message: string;
	code?: number;
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
