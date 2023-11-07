export interface KonectyResponse {
	success: boolean;
	data?: Array<any>;
	errors?: [
		{
			message: string;
		},
	];
}
