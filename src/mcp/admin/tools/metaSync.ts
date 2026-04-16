import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import pLimit from 'p-limit';
import { registerMcpTool } from '../../shared/registerTool';
import { MetaObject } from '@imports/model/MetaObject';
import { z } from 'zod';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { ADMIN_READ_ANNOTATION, ADMIN_WRITE_ANNOTATION } from './common';
import { appendNextSteps, formatRecordList } from '../../shared/textFormatters';

const META_SYNC_UPSERT_CONCURRENCY = 5;

type AdminDeps = {
	user: () => Record<string, unknown>;
};

type MetaSyncItem = {
	_id: string;
	type?: string;
	name?: string;
	[key: string]: unknown;
};

export function registerMetaSyncTool(server: McpServer, deps: AdminDeps): void {
	registerMcpTool(server, 
		'meta_sync_plan',
		{
			description:
				'Builds a sync plan comparing incoming metadata with current database. Returns: plan summary in content.text and { success, plan } in structuredContent.',
			annotations: ADMIN_READ_ANNOTATION,
			inputSchema: {
				items: z.array(z.record(z.unknown())),
			},
		},
		async ({ items }) => {
			const incoming = items as MetaSyncItem[];
			const existingIds = new Set((await MetaObject.MetaObject.find({}, { projection: { _id: 1 } }).toArray()).map(doc => String(doc._id)));

			const plan = incoming.map(item => ({
				_id: item._id,
				action: existingIds.has(item._id) ? 'update' : 'create',
				type: item.type,
				name: item.name,
			}));

			const createCount = plan.filter(item => item.action === 'create').length;
			const updateCount = plan.filter(item => item.action === 'update').length;
			const text = appendNextSteps(
				`Sync plan generated.\nCreates: ${createCount}\nUpdates: ${updateCount}\n${formatRecordList(plan as unknown as Array<Record<string, unknown>>)}`,
				['Review the plan carefully.', 'Call meta_sync_apply with autoApprove=true only when the plan is approved.'],
			);
			return toMcpSuccessResult({ plan }, text);
		},
	);

	registerMcpTool(server, 
		'meta_sync_apply',
		{
			description:
				'Applies sync plan to metadata collection. Returns: apply summary in content.text and { success, applied, total } in structuredContent.',
			annotations: ADMIN_WRITE_ANNOTATION,
			inputSchema: {
				items: z.array(z.record(z.unknown())),
				autoApprove: z.boolean().optional(),
			},
		},
		async ({ items, autoApprove = false }) => {
			if (deps.user().admin !== true) {
				return toMcpErrorResult('FORBIDDEN', 'Admin access required.');
			}
			if (autoApprove !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', 'autoApprove must be true to apply metadata sync.');
			}

			const limit = pLimit(META_SYNC_UPSERT_CONCURRENCY);
			const results = await Promise.all(
				(items as MetaSyncItem[]).map(rawItem =>
					limit(() => MetaObject.MetaObject.replaceOne({ _id: rawItem._id }, rawItem as never, { upsert: true })),
				),
			);
			const upserted = results.reduce((sum, result) => sum + result.upsertedCount + result.modifiedCount, 0);

			const text = appendNextSteps(
				`Metadata sync applied.\nApplied: ${upserted}\nTotal input items: ${items.length}`,
				['Run meta_doctor_run to validate metadata integrity after sync.'],
			);
			return toMcpSuccessResult({ applied: upserted, total: items.length }, text);
		},
	);
}
