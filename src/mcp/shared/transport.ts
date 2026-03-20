import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@imports/utils/logger';
import type { McpReply, McpRequest } from './types';

type McpIncomingMessage = IncomingMessage & { auth?: AuthInfo };

type ActiveSession = {
	server: McpServer;
	transport: StreamableHTTPServerTransport;
};

type TransportRouterOptions = {
	name: string;
	createServer: () => McpServer;
};

type TransportRouter = {
	handlePost: (req: McpRequest, reply: McpReply) => Promise<void>;
	handleGet: (req: McpRequest, reply: McpReply) => Promise<void>;
	handleDelete: (req: McpRequest, reply: McpReply) => Promise<void>;
	closeAll: () => Promise<void>;
};

const BAD_REQUEST_CODE = 400;
const INTERNAL_ERROR_CODE = 500;

export function createTransportRouter(options: TransportRouterOptions): TransportRouter {
	const sessions = new Map<string, ActiveSession>();

	async function initializeSession(req: McpRequest): Promise<ActiveSession> {
		const server = options.createServer();
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => randomUUID(),
			onsessioninitialized: sessionId => {
				sessions.set(sessionId, { server, transport });
			},
		});

		transport.onclose = () => {
			if (transport.sessionId != null) {
				sessions.delete(transport.sessionId);
			}
		};

		await server.connect(transport);
		return { server, transport };
	}

	async function handlePost(req: McpRequest, reply: McpReply): Promise<void> {
		const sessionId = req.headers['mcp-session-id'];

		try {
			if (typeof sessionId === 'string' && sessions.has(sessionId)) {
				await sessions.get(sessionId)!.transport.handleRequest(req.raw as McpIncomingMessage, reply.raw, req.body);
				reply.hijack();
				return;
			}

			if (isInitializeRequest(req.body) !== true) {
				reply.status(BAD_REQUEST_CODE).send({
					jsonrpc: '2.0',
					error: {
						code: -32000,
						message: 'Bad Request: initialize request required when session id is missing',
					},
					id: null,
				});
				return;
			}

			const created = await initializeSession(req);
			await created.transport.handleRequest(req.raw as McpIncomingMessage, reply.raw, req.body);
			reply.hijack();
		} catch (error) {
			logger.error(error, `[mcp:${options.name}] error handling POST request`);
			if (!reply.sent) {
				reply.status(INTERNAL_ERROR_CODE).send({
					jsonrpc: '2.0',
					error: {
						code: -32603,
						message: 'Internal server error',
					},
					id: null,
				});
			}
		}
	}

	async function handleGet(req: McpRequest, reply: McpReply): Promise<void> {
		const sessionId = req.headers['mcp-session-id'];
		if (typeof sessionId !== 'string' || !sessions.has(sessionId)) {
			reply.status(BAD_REQUEST_CODE).send({ error: 'Invalid or missing mcp-session-id' });
			return;
		}

		await sessions.get(sessionId)!.transport.handleRequest(req.raw as McpIncomingMessage, reply.raw);
		reply.hijack();
	}

	async function handleDelete(req: McpRequest, reply: McpReply): Promise<void> {
		const sessionId = req.headers['mcp-session-id'];
		if (typeof sessionId !== 'string' || !sessions.has(sessionId)) {
			reply.status(BAD_REQUEST_CODE).send({ error: 'Invalid or missing mcp-session-id' });
			return;
		}

		const active = sessions.get(sessionId)!;
		await active.transport.handleRequest(req.raw as McpIncomingMessage, reply.raw);
		reply.hijack();
	}

	async function closeAll(): Promise<void> {
		for (const entry of sessions.values()) {
			await entry.transport.close();
			await entry.server.close();
		}
		sessions.clear();
	}

	return {
		handlePost,
		handleGet,
		handleDelete,
		closeAll,
	};
}
