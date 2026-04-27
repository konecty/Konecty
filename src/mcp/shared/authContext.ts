import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage } from 'node:http';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export type McpAuthContext = {
	authTokenId: string;
	user: Record<string, unknown>;
};

type McpIncomingMessage = IncomingMessage & { auth?: AuthInfo };

/**
 * Attach the auth context to the raw Node IncomingMessage so the MCP SDK can
 * propagate it into tool callbacks via `extra.authInfo`. This is the only
 * reliable propagation path: `AsyncLocalStorage` is unreliable across
 * fastify's preHandler/handler boundary and the SDK's Hono-based dispatch.
 */
export function attachMcpAuthToRawRequest(raw: McpIncomingMessage, ctx: McpAuthContext): void {
	if (ctx.authTokenId.length === 0) {
		return;
	}
	raw.auth = {
		token: ctx.authTokenId,
		clientId: 'konecty-mcp',
		scopes: [],
		extra: { user: ctx.user },
	};
}

const storage = new AsyncLocalStorage<McpAuthContext>();

const EMPTY_CONTEXT: McpAuthContext = {
	authTokenId: '',
	user: {},
};

/**
 * Propagates the authenticated MCP context (token + user) for the current
 * request. `enterWith` persists the store across subsequent awaits in the
 * SAME async frame. It MUST be called directly in the fastify preHandler
 * (not inside a helper that awaits before calling it), otherwise the store
 * is only visible within that helper's frame and will be lost on return.
 */
export function setMcpAuthContext(ctx: McpAuthContext): void {
	storage.enterWith(ctx);
}

/**
 * Wraps an async operation so the current auth context propagates even
 * through async resources that would otherwise detach from
 * `AsyncLocalStorage` (e.g. Node streams, event emitters or Hono-based
 * request adapters used by the MCP SDK transport). Prefer this helper to
 * dispatch the MCP transport so tool callbacks keep seeing the context
 * materialised in the fastify preHandler.
 */
export function runWithMcpAuthContext<T>(ctx: McpAuthContext, fn: () => Promise<T>): Promise<T> {
	return storage.run(ctx, fn);
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
