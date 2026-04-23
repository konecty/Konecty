import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { MetaObject } from '@imports/model/MetaObject';
import { toMcpSuccessResult } from '../../shared/errors';
import { ADMIN_READ_ANNOTATION } from './common';
import { appendNextSteps } from '../../shared/textFormatters';

export function registerMetaDoctorTool(server: McpServer): void {
	registerMcpTool(server, 
		'meta_doctor_run',
		{
			description:
				'Runs metadata integrity checks. Returns: integrity summary in content.text and { success, issues, total } in structuredContent.',
			annotations: ADMIN_READ_ANNOTATION,
		},
		async () => {
			const issues: Array<{ id: string; message: string }> = [];
			const docs = await MetaObject.MetaObject.find({}).toArray();

			for (const doc of docs) {
				if (typeof doc._id !== 'string' || doc._id.length === 0) {
					issues.push({ id: String(doc._id ?? ''), message: 'Invalid metadata id' });
				}
				if (typeof (doc as { type?: unknown }).type !== 'string') {
					issues.push({ id: String(doc._id), message: 'Missing metadata type' });
				}
				if (typeof (doc as { name?: unknown }).name !== 'string') {
					issues.push({ id: String(doc._id), message: 'Missing metadata name' });
				}
			}

			const issueLines = issues.slice(0, 15).map((issue, index) => `${index + 1}. ${issue.id}: ${issue.message}`);
			const summary =
				issues.length === 0
					? `Metadata integrity check passed. Checked ${docs.length} metadata document(s).`
					: `Metadata integrity check completed with issues.\nChecked ${docs.length} metadata document(s).\nIssues found: ${issues.length}\n${issueLines.join('\n')}`;
			const text = appendNextSteps(summary, issues.length > 0 ? ['Fix reported issues and rerun meta_doctor_run to validate integrity.'] : []);
			return toMcpSuccessResult(
				{
					issues,
					total: docs.length,
				},
				text,
			);
		},
	);
}
