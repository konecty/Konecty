import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const ADMIN_AUTH_GUIDANCE =
	'All admin tools require a token from an admin user obtained outside this MCP. Send authTokenId via HTTP Authorization header (raw authTokenId preferred; Bearer accepted). Cookie fallback is authTokenId/_authTokenId.';

const ADMIN_PROMPTS: Record<string, string> = {
	add_field_to_document:
		`Read target metadata using meta_read, extend document schema with the new field, validate consistency, and persist with meta_document_upsert. ${ADMIN_AUTH_GUIDANCE}`,
	create_access_profile:
		`Inspect current access metadata, define read/create/update/delete permissions carefully, then apply with meta_access_upsert. ${ADMIN_AUTH_GUIDANCE}`,
	write_hook:
		`Draft hook script without imports or comments, validate with meta_hook_validate, and only persist with meta_hook_upsert after validation passes. ${ADMIN_AUTH_GUIDANCE}`,
	sync_metadata:
		`Generate diff with meta_sync_plan, review creates and updates, then run meta_sync_apply with explicit approval. ${ADMIN_AUTH_GUIDANCE}`,
	diagnose_metadata:
		`Run meta_doctor_run, prioritize structural issues, and propose deterministic corrections before applying any updates. ${ADMIN_AUTH_GUIDANCE}`,
	configure_namespace:
		`Review namespace constraints and update operational fields through meta_namespace_update with minimal and explicit patch payloads. ${ADMIN_AUTH_GUIDANCE}`,
};

export function registerAdminPrompts(server: McpServer): void {
	for (const [name, instruction] of Object.entries(ADMIN_PROMPTS)) {
		server.registerPrompt(
			name,
			{
				description: `Admin MCP prompt: ${name}`,
			},
			async () => ({
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: instruction,
						},
					},
				],
			}),
		);
	}
}
