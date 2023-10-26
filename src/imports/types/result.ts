export type KonectyError = {
	message: string;
	code?: number;
};

export type KonectyResult<T = unknown> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			errors: Array<KonectyError>;
	  };
