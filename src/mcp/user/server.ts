import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { createTransportRouter } from '../shared/transport';
import { buildSessionRouteRateLimit, buildUserRouteRateLimit, registerMcpRateLimitPlugin } from '../shared/rateLimiter';
import { guardMcpFeatureEnabled } from '../shared/sessionGuard';
import { attachMcpAuthToRawRequest, getCurrentAuthTokenId, getCurrentUser, setMcpAuthContext } from '../shared/authContext';
import { registerUserWidgetResources } from './widgets';
import { registerUserTools } from './tools';
import { registerUserPrompts } from './prompts';

const DEFAULT_MCP_PAYLOAD_LIMIT = 1024 * 1024;

export const userMcpPlugin: FastifyPluginAsync = async fastify => {
	await registerMcpRateLimitPlugin(fastify);

	// Resolve auth context and RETURN it. The caller must invoke
	// `setMcpAuthContext` in its own async frame so that `AsyncLocalStorage.enterWith`
	// persists through subsequent awaits (including the MCP transport dispatch).
	// See note below in the preHandler for why `enterWith` must not run inside this helper.
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
		name: 'user',
		createServer: () => {
			const server = new McpServer({
				name: 'konecty-user-mcp',
				version: '1.0.0',
			});

			registerUserWidgetResources(server);
			registerUserPrompts(server);
			registerUserTools(server, {
				authTokenId: () => getCurrentAuthTokenId(),
				user: () => getCurrentUser(),
				baseUiUrl: process.env.KONECTY_UI_BASE_URL ?? 'http://localhost:3010',
				baseApiUrl: process.env.KONECTY_URL ?? process.env.BASE_URL ?? 'http://localhost:3000',
				callAuthApi: async (path, payload) => {
					const response = await fastify.inject({
						method: 'POST',
						url: path,
						payload,
					});
					try {
						return response.json();
					} catch {
						return { success: response.statusCode >= 200 && response.statusCode < 300, raw: response.body };
					}
				},
			});

			return server;
		},
	});

	fastify.addHook('preHandler', async (req, reply) => {
		// Always check feature flag
		const enabled = await guardMcpFeatureEnabled('user', reply);
		if (!enabled) {
			return reply;
		}

		// Resolve auth for all requests so tools can use it; the initialize
		// handshake carries no token — that is intentional and allowed.
		// IMPORTANT: `enterWith` must run in THIS preHandler's async frame.
		// If we awaited a helper that called `enterWith` internally (after its
		// own `await`), the store would only be visible inside that helper and
		// not here, because each awaited frame has its own async resource.
		const authCtx = await resolveAuthContext(req);
		setMcpAuthContext(authCtx);
		// Attach auth to the raw request so the SDK can propagate it via
		// `extra.authInfo` to tool callbacks. ALS alone does not survive
		// fastify's preHandler/handler boundary nor the SDK's Hono dispatch.
		attachMcpAuthToRawRequest(req.raw, authCtx);
		return undefined;
	});

	fastify.post(
		'/',
		{
			config: buildUserRouteRateLimit(),
			bodyLimit: DEFAULT_MCP_PAYLOAD_LIMIT,
		},
		async (req, reply) => {
			await transportRouter.handlePost(req, reply);
		},
	);

	fastify.get(
		'/',
		{
			config: buildSessionRouteRateLimit(),
		},
		async (req, reply) => {
			await transportRouter.handleGet(req, reply);
		},
	);

	fastify.delete(
		'/',
		{
			config: buildSessionRouteRateLimit(),
		},
		async (req, reply) => {
			await transportRouter.handleDelete(req, reply);
		},
	);

	fastify.addHook('onClose', async () => {
		await transportRouter.closeAll();
	});
};

export default fp(userMcpPlugin, {
	name: 'user-mcp-plugin',
	fastify: '4.x',
	encapsulate: true,
});
