import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { createTransportRouter } from '../shared/transport';
import { buildAdminRouteRateLimit, registerMcpRateLimitPlugin } from '../shared/rateLimiter';
import { guardMcpFeatureEnabled } from '../shared/sessionGuard';
import { attachMcpAuthToRawRequest, getCurrentUser, setMcpAuthContext } from '../shared/authContext';
import { registerAdminTools } from './tools';
import { registerAdminPrompts } from './prompts';

const DEFAULT_MCP_PAYLOAD_LIMIT = 1024 * 1024;
const HTTP_FORBIDDEN = 403;

export const adminMcpPlugin: FastifyPluginAsync = async fastify => {
	await registerMcpRateLimitPlugin(fastify);

	// Resolve auth context and RETURN it. The caller must invoke
	// `setMcpAuthContext` in its own async frame so that `AsyncLocalStorage.enterWith`
	// persists through subsequent awaits. See preHandler below.
	const resolveAuthContext = async (
		req: Parameters<typeof getAuthTokenIdFromReq>[0],
	): Promise<{ authTokenId: string; user: Record<string, unknown> }> => {
		const authTokenId = getAuthTokenIdFromReq(req) ?? '';
		if (authTokenId.length === 0) {
			return { authTokenId: '', user: {} };
		}

		const userResult = await getUserSafe(authTokenId);
		const user = userResult.success === true ? (userResult.data as unknown as Record<string, unknown>) : {};
		return { authTokenId, user };
	};

	const transportRouter = createTransportRouter({
		name: 'admin',
		createServer: () => {
			const server = new McpServer({
				name: 'konecty-admin-mcp',
				version: '1.0.0',
			});

			registerAdminTools(server, {
				user: () => getCurrentUser(),
			});
			registerAdminPrompts(server);

			return server;
		},
	});

	fastify.addHook('preHandler', async (req, reply) => {
		const enabled = await guardMcpFeatureEnabled('admin', reply);
		if (!enabled) {
			return reply;
		}

		// IMPORTANT: `enterWith` must be invoked HERE, not inside the helper.
		// `AsyncLocalStorage.enterWith` mutates the current async resource and
		// propagates to subsequent continuations of THIS frame. If we ran it
		// inside a helper that itself awaited before calling `enterWith`, the
		// store would only be visible inside that helper and would be lost
		// when control returned to this preHandler.
		const authCtx = await resolveAuthContext(req);
		setMcpAuthContext(authCtx);

		// Require admin for every request, including the initialize handshake.
		// The MCP client must send authTokenId from the start; we do not want
		// to allow an un-authenticated init that later gets hijacked.
		if ((authCtx.user.admin as boolean | undefined) !== true) {
			reply.status(HTTP_FORBIDDEN).send({ error: 'Admin access required' });
			return reply;
		}

		// Attach auth to the raw request so the SDK can propagate it via
		// `extra.authInfo` to tool callbacks. ALS alone does not survive
		// fastify's preHandler/handler boundary nor the SDK's Hono dispatch.
		attachMcpAuthToRawRequest(req.raw, authCtx);
		return undefined;
	});

	fastify.post(
		'/',
		{
			config: buildAdminRouteRateLimit(),
			bodyLimit: DEFAULT_MCP_PAYLOAD_LIMIT,
		},
		async (req, reply) => {
			await transportRouter.handlePost(req, reply);
		},
	);

	fastify.get(
		'/',
		{
			config: buildAdminRouteRateLimit(),
		},
		async (req, reply) => {
			await transportRouter.handleGet(req, reply);
		},
	);

	fastify.delete(
		'/',
		{
			config: buildAdminRouteRateLimit(),
		},
		async (req, reply) => {
			await transportRouter.handleDelete(req, reply);
		},
	);

	fastify.addHook('onClose', async () => {
		await transportRouter.closeAll();
	});
};

export default fp(adminMcpPlugin, {
	name: 'admin-mcp-plugin',
	fastify: '4.x',
	encapsulate: true,
});
