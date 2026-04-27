import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { z } from 'zod';
import { proxyMetaNamespaceUpdate } from '../../shared/konectyProxy';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { ADMIN_WRITE_ANNOTATION } from './common';
import { appendNextSteps, formatKeyValues } from '../../shared/textFormatters';

type AdminDeps = {
	user: () => Record<string, unknown>;
};

export function registerMetaNamespaceTool(server: McpServer, deps: AdminDeps): void {
	registerMcpTool(server, 
		'meta_namespace_update',
		{
			description: 'Updates namespace metadata. Returns: update summary in content.text and { success, result } in structuredContent.',
			annotations: ADMIN_WRITE_ANNOTATION,
			inputSchema: {
				patch: z.record(z.unknown()),
			},
		},
		async ({ patch }) => {
			const result = await proxyMetaNamespaceUpdate(deps.user(), patch);
			if (result.success !== true) {
				return toMcpErrorResult('FORBIDDEN', JSON.stringify(result.errors ?? []));
			}
			const payload = result.data as Record<string, unknown>;
			const text = appendNextSteps(
				`Namespace metadata updated.\n${formatKeyValues(payload)}`,
				['Run meta_read for the namespace object to validate final state.'],
			);
			return toMcpSuccessResult({ result: result.data }, text);
		},
	);
}
