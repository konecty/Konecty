/**
 * Type-safe wrapper for McpServer.registerTool that bridges the Zod v3/v4 incompatibility.
 *
 * MCP SDK v1.x bundles Zod v4 internally. Our project uses Zod v3. TypeScript's structural
 * type checker rejects Zod v3 schemas in registerTool because internal types like ParseInput
 * and ZodError differ between the two package instances — even though the SDK handles Zod v3
 * correctly at runtime via its zod-compat layer.
 *
 * This wrapper accepts Zod v3 ZodRawShape and properly infers callback argument types via
 * z.infer<ZodObject<TShape>>, concentrating the single `as any` cast here instead of
 * spreading it across all tool files.
 */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape, ZodObject, z } from 'zod';
import { runWithMcpAuthContext } from './authContext';

export interface McpToolOptions<TShape extends ZodRawShape> {
	title?: string;
	description?: string;
	annotations?: ToolAnnotations;
	inputSchema?: TShape;
	_meta?: Record<string, unknown>;
}

export type McpToolCallback<TShape extends ZodRawShape> = (
	args: z.infer<ZodObject<TShape>>,
	extra: unknown,
) => CallToolResult | Promise<CallToolResult>;

type AuthInfoLike = {
	token?: unknown;
	extra?: { user?: unknown } & Record<string, unknown>;
};

type ExtraWithAuth = {
	authInfo?: AuthInfoLike;
};

function extractAuthContext(extra: unknown): { authTokenId: string; user: Record<string, unknown> } | undefined {
	const authInfo = (extra as ExtraWithAuth | undefined)?.authInfo;
	if (authInfo == null) {
		return undefined;
	}
	const token = typeof authInfo.token === 'string' ? authInfo.token : '';
	if (token.length === 0) {
		return undefined;
	}
	const user = (authInfo.extra?.user as Record<string, unknown> | undefined) ?? {};
	return { authTokenId: token, user };
}

/**
 * Registers a tool on the MCP server and ensures every invocation runs inside
 * the correct `AsyncLocalStorage` frame. The SDK's Streamable HTTP transport
 * dispatches callbacks through Hono's Web Standard adapter, which does not
 * preserve ALS context. We rehydrate the store here from `extra.authInfo`
 * (populated by the fastify plugin before calling `transport.handleRequest`)
 * so existing tools keep reading the authenticated context via
 * `getCurrentAuthTokenId()` / `getCurrentUser()` without changes.
 */
export function registerMcpTool<TShape extends ZodRawShape>(
	server: McpServer,
	name: string,
	options: McpToolOptions<TShape>,
	callback: McpToolCallback<TShape>,
): RegisteredTool {
	const wrapped: McpToolCallback<TShape> = (args, extra) => {
		const ctx = extractAuthContext(extra);
		if (ctx == null) {
			return callback(args, extra);
		}
		return runWithMcpAuthContext(ctx, async () => callback(args, extra));
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (server as any).registerTool(name, options, wrapped);
}
