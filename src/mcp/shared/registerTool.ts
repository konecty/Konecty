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

export function registerMcpTool<TShape extends ZodRawShape>(
	server: McpServer,
	name: string,
	options: McpToolOptions<TShape>,
	callback: McpToolCallback<TShape>,
): RegisteredTool {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (server as any).registerTool(name, options, callback);
}
