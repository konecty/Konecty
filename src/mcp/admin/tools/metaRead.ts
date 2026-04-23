import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { z } from 'zod';
import { proxyMetaRead } from '../../shared/konectyProxy';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { ADMIN_READ_ANNOTATION } from './common';
import { appendNextSteps, formatKeyValues } from '../../shared/textFormatters';

type AdminDeps = {
	user: () => Record<string, unknown>;
};

export function registerMetaReadTool(server: McpServer, deps: AdminDeps): void {
	registerMcpTool(server, 
		'meta_read',
		{
			description: 'Reads metadata document by name. Returns: metadata summary in content.text and { success, meta } in structuredContent.',
			annotations: ADMIN_READ_ANNOTATION,
			inputSchema: {
				name: z.string(),
			},
		},
		async ({ name }) => {
			const result = await proxyMetaRead(deps.user(), name);
			if (result.success !== true) {
				return toMcpErrorResult('NOT_FOUND', JSON.stringify(result.errors ?? []));
			}

			const meta = result.data as Record<string, unknown>;
			const text = appendNextSteps(
				`Metadata document loaded.\n${formatKeyValues(meta)}`,
				['Use the appropriate meta_*_upsert tool to apply metadata changes.'],
			);
			return toMcpSuccessResult({ meta }, text);
		},
	);
}
