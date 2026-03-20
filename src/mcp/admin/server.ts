import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { createTransportRouter } from '../shared/transport';
import { buildAdminRouteRateLimit, registerMcpRateLimitPlugin } from '../shared/rateLimiter';
import { guardMcpFeatureEnabled } from '../shared/sessionGuard';
import { registerAdminTools } from './tools';
import { registerAdminPrompts } from './prompts';

const DEFAULT_MCP_PAYLOAD_LIMIT = 1024 * 1024;

export const adminMcpPlugin: FastifyPluginAsync = async fastify => {
	await registerMcpRateLimitPlugin(fastify);

	let currentUser: Record<string, unknown> = {};

	const resolveCurrentUser = async (req: Parameters<typeof getAuthTokenIdFromReq>[0]) => {
		const authTokenId = getAuthTokenIdFromReq(req) ?? '';
		if (authTokenId.length === 0) {
			currentUser = {};
			return;
		}

		const userResult = await getUserSafe(authTokenId);
		currentUser = userResult.success === true ? (userResult.data as unknown as Record<string, unknown>) : {};
	};

	const transportRouter = createTransportRouter({
		name: 'admin',
		createServer: () => {
			const server = new McpServer({
				name: 'konecty-admin-mcp',
				version: '1.0.0',
			});

			registerAdminTools(server, {
				user: () => currentUser,
			});
			registerAdminPrompts(server);

			return server;
		},
	});

	fastify.addHook('preHandler', async (req, reply) => {
		// Always check feature flag first
		const enabled = await guardMcpFeatureEnabled('admin', reply);
		if (!enabled) {
			return reply;
		}

		// The MCP initialize handshake carries no auth token by design.
		// Only enforce admin check once the session is established (mcp-session-id present).
		const sessionId = req.headers['mcp-session-id'];
		const isInitialize = sessionId == null || sessionId === '';

		await resolveCurrentUser(req);

		if (!isInitialize && currentUser.admin !== true) {
			reply.status(403).send({ error: 'Admin access required' });
			return reply;
		}

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
