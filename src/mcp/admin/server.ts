import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { createTransportRouter } from '../shared/transport';
import { buildAdminRouteRateLimit, registerMcpRateLimitPlugin } from '../shared/rateLimiter';
import { guardMcpFeatureEnabled } from '../shared/sessionGuard';
import { getCurrentUser, setMcpAuthContext } from '../shared/authContext';
import { registerAdminTools } from './tools';
import { registerAdminPrompts } from './prompts';

const DEFAULT_MCP_PAYLOAD_LIMIT = 1024 * 1024;
const HTTP_FORBIDDEN = 403;

export const adminMcpPlugin: FastifyPluginAsync = async fastify => {
	await registerMcpRateLimitPlugin(fastify);

	const resolveCurrentUser = async (req: Parameters<typeof getAuthTokenIdFromReq>[0]) => {
		const authTokenId = getAuthTokenIdFromReq(req) ?? '';
		if (authTokenId.length === 0) {
			setMcpAuthContext({ authTokenId: '', user: {} });
			return;
		}

		const userResult = await getUserSafe(authTokenId);
		const user = userResult.success === true ? (userResult.data as unknown as Record<string, unknown>) : {};
		setMcpAuthContext({ authTokenId, user });
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

		await resolveCurrentUser(req);

		// Require admin for every request, including the initialize handshake.
		// The MCP client must send authTokenId from the start; we do not want
		// to allow an un-authenticated init that later gets hijacked.
		if (getCurrentUser().admin !== true) {
			reply.status(HTTP_FORBIDDEN).send({ error: 'Admin access required' });
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
