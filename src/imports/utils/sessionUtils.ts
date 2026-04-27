import { FastifyRequest } from 'fastify';
import '@fastify/cookie';

function parseAuthorizationHeader(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	// Accept both raw authTokenId and conventional Bearer token format.
	const bearerPrefix = 'bearer ';
	if (trimmed.toLowerCase().startsWith(bearerPrefix)) {
		const token = trimmed.slice(bearerPrefix.length).trim();
		return token.length > 0 ? token : undefined;
	}

	return trimmed;
}

export function getAuthTokenIdFromReq(req: FastifyRequest): string | undefined {
	const headerToken = parseAuthorizationHeader(req.headers['authorization']);
	if (headerToken != null) {
		return headerToken;
	}

	if (req.cookies['authTokenId'] != null) {
		return req.cookies['authTokenId'];
	}
	if (req.cookies['_authTokenId'] != null) {
		return req.cookies['_authTokenId'];
	}

	return undefined;
}
