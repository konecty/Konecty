export interface KonectyResponse {
	success: boolean;
	data?: Array<Record<string, unknown>>;
	errors?: [
		{
			message: string;
		},
	];
	total?: number;
}
