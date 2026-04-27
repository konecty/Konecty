import { getUserSafe } from '@imports/auth/getUser';
import { MetaObject } from '@imports/model/MetaObject';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { FastifyReply } from 'fastify';
import type { McpRequest, McpFeature } from './types';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_SERVICE_UNAVAILABLE = 503;

export async function guardMcpFeatureEnabled(feature: McpFeature, reply: FastifyReply): Promise<boolean> {
	const namespace = MetaObject.Namespace;
	// When the flag is undefined (not yet configured), default to enabled so
	// clients can complete the MCP initialize handshake without 503 errors.
	const flag = feature === 'user' ? namespace?.mcpUserEnabled : namespace?.mcpAdminEnabled;
	const enabled = flag !== false;
	if (!enabled) {
		reply.status(HTTP_SERVICE_UNAVAILABLE).send({ error: 'MCP endpoint disabled in namespace configuration' });
		return false;
	}
	return true;
}

export async function requireAuthenticatedUser(req: McpRequest, reply: FastifyReply): Promise<{ authTokenId: string; user: Record<string, unknown> } | null> {
	const authTokenId = getAuthTokenIdFromReq(req);
	const userResult = await getUserSafe(authTokenId);
	if (userResult.success === false) {
		reply.status(HTTP_UNAUTHORIZED).send({
			error:
				'Unauthorized. Send authTokenId in Authorization header (preferred: "Bearer <authTokenId>" or raw token) or cookies authTokenId/_authTokenId.',
		});
		return null;
	}

	return {
		authTokenId: authTokenId ?? '',
		user: userResult.data as unknown as Record<string, unknown>,
	};
}

export async function requireAdminUser(req: McpRequest, reply: FastifyReply): Promise<{ authTokenId: string; user: Record<string, unknown> } | null> {
	const auth = await requireAuthenticatedUser(req, reply);
	if (auth == null) {
		return null;
	}

	if (auth.user.admin !== true) {
		reply.status(HTTP_FORBIDDEN).send({
			error:
				'Admin access required. Authenticate with a token from an admin user via Authorization header (preferred: "Bearer <authTokenId>" or raw token) or cookies authTokenId/_authTokenId.',
		});
		return null;
	}

	return auth;
}
