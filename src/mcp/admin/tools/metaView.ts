import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { z } from 'zod';
import { proxyMetaUpsert } from '../../shared/konectyProxy';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { ADMIN_WRITE_ANNOTATION } from './common';
import { appendNextSteps, formatKeyValues } from '../../shared/textFormatters';

type AdminDeps = {
	user: () => Record<string, unknown>;
};

export function registerMetaViewTool(server: McpServer, deps: AdminDeps): void {
	registerMcpTool(server, 
		'meta_view_upsert',
		{
			description: 'Creates or updates view metadata. Returns: save summary in content.text and { success, result } in structuredContent.',
			annotations: ADMIN_WRITE_ANNOTATION,
			inputSchema: {
				id: z.string(),
				view: z.record(z.unknown()),
			},
		},
		async ({ id, view }) => {
			const result = await proxyMetaUpsert(deps.user(), id, view);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const payload = result.data as Record<string, unknown>;
			const text = appendNextSteps(
				`View metadata saved.\n${formatKeyValues(payload)}`,
				['Run meta_read to verify view metadata changes.'],
			);
			return toMcpSuccessResult({ result: result.data }, text);
		},
	);
}
