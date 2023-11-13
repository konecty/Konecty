import { KonectyResponse } from './types';

interface KonResponse extends Response {
	json(): Promise<KonectyResponse>;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/rest';

export const get = async (url: string, authorization?: string, options: RequestInit = {}) => {
	if (authorization) {
		options.headers = {
			Authorization: authorization,
			cookie: `_authTokenId=${authorization}`,
		};
	}

	const response = await fetch(`${BASE_URL}${url}`, {
		method: 'GET',
		...options,
	});

	return response as KonResponse;
};

const requestWithBody =
	(method: string) =>
	async (url: string, payload: unknown, authorization?: string, options: RequestInit = {}) => {
		if (authorization) {
			options.headers = {
				Authorization: authorization,
				cookie: `_authTokenId=${authorization}`,
				'Content-Type': 'application/json',
			};
		}

		const response = await fetch(`${BASE_URL}${url}`, {
			method,
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json',
			},
			...options,
		});

		return response as KonResponse;
	};

export const post = requestWithBody('POST');
export const put = requestWithBody('PUT');
