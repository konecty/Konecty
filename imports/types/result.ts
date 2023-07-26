export type KonectyError = {
	message: string;
	code?: number;
};

export type KonectyResult<T> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			errors: Array<KonectyError>;
	  };
