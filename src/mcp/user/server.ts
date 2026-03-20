import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { createTransportRouter } from '../shared/transport';
import { buildSessionRouteRateLimit, buildUserRouteRateLimit, registerMcpRateLimitPlugin } from '../shared/rateLimiter';
import { guardMcpFeatureEnabled } from '../shared/sessionGuard';
import { registerUserWidgetResources } from './widgets';
import { registerUserTools } from './tools';
import { registerUserPrompts } from './prompts';

const DEFAULT_MCP_PAYLOAD_LIMIT = 1024 * 1024;

export const userMcpPlugin: FastifyPluginAsync = async fastify => {
	await registerMcpRateLimitPlugin(fastify);

	let currentAuthToken = '';
	let currentUser: Record<string, unknown> = {};

	const resolveCurrentAuth = async (req: Parameters<typeof getAuthTokenIdFromReq>[0]) => {
		currentAuthToken = getAuthTokenIdFromReq(req) ?? '';
		if (currentAuthToken.length === 0) {
			currentUser = {};
			return;
		}

		const userResult = await getUserSafe(currentAuthToken);
		currentUser = userResult.success === true ? (userResult.data as unknown as Record<string, unknown>) : {};
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
				authTokenId: () => currentAuthToken,
				user: () => currentUser,
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
		await resolveCurrentAuth(req);
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
