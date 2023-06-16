import { IncomingMessage } from 'http';
import cookie from 'cookie';

export function getAuthTokenIdFromReq(req: IncomingMessage): string | undefined | null {
	if (req.headers['authorization'] != null) {
		return req.headers['authorization'] as string;
	}
	const cookies = cookie.parse(req.headers.cookie ?? '');

	if (cookies['authTokenId'] != null) {
		return cookies['authTokenId'];
	}
	if (cookies['_authTokenId'] != null) {
		return cookies['_authTokenId'];
	}

	return null;
}
