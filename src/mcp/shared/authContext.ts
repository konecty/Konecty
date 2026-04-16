import { AsyncLocalStorage } from 'node:async_hooks';

export type McpAuthContext = {
	authTokenId: string;
	user: Record<string, unknown>;
};

const storage = new AsyncLocalStorage<McpAuthContext>();

const EMPTY_CONTEXT: McpAuthContext = {
	authTokenId: '',
	user: {},
};

/**
 * Propagates the authenticated MCP context (token + user) for the current
 * request. Using `enterWith` ensures every async continuation triggered by
 * the fastify request (including the MCP transport and tool callbacks)
 * reads the correct value instead of a plugin-scoped variable that other
 * concurrent requests could overwrite.
 */
export function setMcpAuthContext(ctx: McpAuthContext): void {
	storage.enterWith(ctx);
}

export function getMcpAuthContext(): McpAuthContext {
	return storage.getStore() ?? EMPTY_CONTEXT;
}

export function getCurrentAuthTokenId(): string {
	return getMcpAuthContext().authTokenId;
}

export function getCurrentUser(): Record<string, unknown> {
	return getMcpAuthContext().user;
}
