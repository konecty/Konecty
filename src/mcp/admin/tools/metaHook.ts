import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { z } from 'zod';
import { proxyMetaUpsert } from '../../shared/konectyProxy';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { ADMIN_READ_ANNOTATION, ADMIN_WRITE_ANNOTATION } from './common';
import { appendNextSteps, formatKeyValues } from '../../shared/textFormatters';

type AdminDeps = {
	user: () => Record<string, unknown>;
};

const HookSchema = z.object({
	script: z.string().min(1),
});

function validateHookScript(script: string): { valid: boolean; reasons: string[] } {
	const reasons: string[] = [];

	if (/require\(/.test(script) || /import\s+/.test(script)) {
		reasons.push('Hook script cannot import external modules.');
	}

	if (/\/\/|\/\*/.test(script)) {
		reasons.push('Hook script should not contain comments.');
	}

	return {
		valid: reasons.length === 0,
		reasons,
	};
}

export function registerMetaHookTool(server: McpServer, deps: AdminDeps): void {
	registerMcpTool(server, 
		'meta_hook_validate',
		{
			description:
				'Validates hook script before save. Returns: validation summary in content.text and { success, validation } in structuredContent.',
			annotations: ADMIN_READ_ANNOTATION,
			inputSchema: {
				script: z.string(),
			},
		},
		async ({ script }) => {
			const parsed = HookSchema.safeParse({ script });
			if (!parsed.success) {
				return toMcpErrorResult('VALIDATION_ERROR', parsed.error.issues.map(issue => issue.message).join('; '));
			}

			const validation = validateHookScript(script);
			if (!validation.valid) {
				return toMcpErrorResult('VALIDATION_ERROR', validation.reasons.join(' '));
			}

			const text = appendNextSteps(
				`Hook validation passed.\n${formatKeyValues(validation as unknown as Record<string, unknown>)}`,
				['Call meta_hook_upsert to persist the hook metadata after validation.'],
			);
			return toMcpSuccessResult({ validation }, text);
		},
	);

	registerMcpTool(server, 
		'meta_hook_upsert',
		{
			description:
				'Creates or updates hook metadata after validation. Returns: save summary in content.text and { success, result } in structuredContent.',
			annotations: ADMIN_WRITE_ANNOTATION,
			inputSchema: {
				id: z.string(),
				hook: z.record(z.unknown()),
			},
		},
		async ({ id, hook }) => {
			const script = typeof hook.script === 'string' ? hook.script : '';
			const validation = validateHookScript(script);
			if (!validation.valid) {
				return toMcpErrorResult('VALIDATION_ERROR', validation.reasons.join(' '));
			}

			const result = await proxyMetaUpsert(deps.user(), id, hook);
			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
			}
			const payload = result.data as Record<string, unknown>;
			const text = appendNextSteps(
				`Hook metadata saved.\n${formatKeyValues(payload)}`,
				['Run meta_read to confirm the final hook metadata state.'],
			);
			return toMcpSuccessResult({ result: result.data }, text);
		},
	);
}
