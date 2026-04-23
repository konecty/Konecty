import { FastifyReply, FastifyRequest } from 'fastify';

export type JsonRecord = Record<string, unknown>;

export type McpFeature = 'user' | 'admin';

export type McpRequest = FastifyRequest & {
	raw: FastifyRequest['raw'] & {
		auth?: JsonRecord;
	};
};

export type McpReply = FastifyReply;

export type McpAuthContext = {
	authTokenId: string;
	user: JsonRecord;
};

export type McpFeatureFlags = {
	mcpUserEnabled?: boolean;
	mcpAdminEnabled?: boolean;
};

export type McpServerFactory = () => Promise<{
	handlePost: (req: McpRequest, reply: McpReply) => Promise<void>;
	handleGet: (req: McpRequest, reply: McpReply) => Promise<void>;
	handleDelete: (req: McpRequest, reply: McpReply) => Promise<void>;
	close: () => Promise<void>;
}>;
