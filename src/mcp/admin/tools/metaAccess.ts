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

export function registerMetaAccessTool(server: McpServer, deps: AdminDeps): void {
	registerMcpTool(server, 
		'meta_access_upsert',
		{
			description:
				'Creates or updates access profile metadata. Returns: save summary in content.text and { success, result } in structuredContent.',
			annotations: ADMIN_WRITE_ANNOTATION,
			inputSchema: {
				id: z.string(),
				access: z.record(z.unknown()),
			},
		},
		async ({ id, access }) => {
			const result = await proxyMetaUpsert(deps.user(), id, access);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const payload = result.data as Record<string, unknown>;
			const text = appendNextSteps(
				`Access metadata saved.\n${formatKeyValues(payload)}`,
				['Run meta_read to inspect updated access rules.'],
			);
			return toMcpSuccessResult({ result: result.data }, text);
		},
	);
}
