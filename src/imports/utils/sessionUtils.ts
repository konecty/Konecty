import { FastifyRequest } from 'fastify';

export function getAuthTokenIdFromReq(req: FastifyRequest): string | undefined {
	if (req.headers['authorization'] != null) {
		return req.headers['authorization'] as string;
	}
	

	if (req.cookies['authTokenId'] != null) {
		return req.cookies['authTokenId'];
	}
	if (req.cookies['_authTokenId'] != null) {
		return req.cookies['_authTokenId'];
	}

	return undefined;
}
