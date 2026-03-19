import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const AUTH_GUIDANCE =
	'This MCP is stateless. For protected tools, first run OTP flow, store authId from session_verify_otp_email/session_verify_otp_phone, and pass it as authTokenId argument in every authenticated tool call. HTTP fallback is Authorization header (raw authTokenId preferred; Bearer accepted) or cookies authTokenId/_authTokenId.';

const OTP_INPUT_GUIDANCE =
	'For OTP flow, use channel-specific tools: session_request_otp_email/session_verify_otp_email or session_request_otp_phone/session_verify_otp_phone. Never mix channels.';

const FILTER_FORMAT_GUIDANCE =
	'CRITICAL — Konecty filter format: { "match": "and"|"or", "conditions": [{ "term": "<fieldName>", "operator": "<op>", "value": "<val>" }] }. ' +
	'Operators: equals, not_equals, contains, not_contains, starts_with, end_with, in (value is array), not_in (value is array), greater_than, less_than, greater_or_equals, less_or_equals, between (value: { "greater_or_equals": ..., "less_or_equals": ... }), exists (value: true/false). ' +
	'Example: { "match": "and", "conditions": [{ "term": "status", "operator": "equals", "value": "Ativo" }] }. ' +
	'For lookup fields use term "field._id" with operator "equals" or "in". ' +
	'For nested OR: { "match": "and", "filters": [{ "match": "or", "conditions": [...] }] }. ' +
	'NEVER use Mongo-style { "field": "value" } — it is silently ignored.';

const USER_PROMPTS: Record<string, string> = {
	authenticate:
		`Use session_login_options to inspect available auth methods. If email OTP is enabled, call session_request_otp_email and then session_verify_otp_email. If phone/WhatsApp OTP is enabled, call session_request_otp_phone and then session_verify_otp_phone. Store authId returned by the verify tool and pass it as authTokenId in every protected tool call. OTP-only flow must be respected. ${OTP_INPUT_GUIDANCE} ${AUTH_GUIDANCE}`,
	find_records:
		`First call modules_list and pick modules[].document (technical _id). Never use modules[].label or module display name as document. Then call modules_fields with that _id, inspect field types. Before filtering by a picklist field, call field_picklist_options. Before filtering by a lookup field, call field_lookup_search to resolve the related record _id. ${FILTER_FORMAT_GUIDANCE} For sort, use Konecty format: [{"property":"_createdAt","direction":"DESC"}] (or term instead of property). Do not use Mongo sort like {"_createdAt":-1}. Do not use query_sql for single-module listing tasks; use records_find. ${AUTH_GUIDANCE}`,
	create_record:
		`First resolve the document via modules_list.modules[].document (_id, not label/name). Inspect fields with modules_fields, validate required values and lookups, then execute records_create. Return created identifiers and key fields. ${AUTH_GUIDANCE}`,
	update_record:
		`Resolve document via modules_list.modules[].document (_id, not label/name). Then call records_find_by_id to fetch latest _updatedAt, and call records_update with ids including _id and _updatedAt to preserve optimistic locking. ${AUTH_GUIDANCE}`,
	delete_record:
		`Resolve document via modules_list.modules[].document (_id, not label/name). Always call records_delete_preview first, present deletion impact, require explicit confirmation, then call records_delete with confirm=true and one record per request. ${AUTH_GUIDANCE}`,
	cross_module_query:
		`Decision rule: default to query_json for cross-module retrievals. Use query_sql only when the user explicitly asks for SQL syntax or provides an SQL statement to execute. For module identifiers, always resolve technical _id via modules_list and never rely on label/name. ${AUTH_GUIDANCE}`,
	build_pivot:
		`Prepare rows, columns, values and filters, run query_pivot, inspect aggregated output, and call render_pivot_widget when visual representation is requested. ${FILTER_FORMAT_GUIDANCE} ${AUTH_GUIDANCE}`,
	build_graph:
		`Define graphConfig for axes and aggregation, run query_graph, and call render_graph_widget to display SVG output. ${FILTER_FORMAT_GUIDANCE} ${AUTH_GUIDANCE}`,
	upload_file:
		`Upload binary using platform upload flow, then call file_upload with file metadata payload and link it to the record field. Use records_update for additional associations when necessary. ${AUTH_GUIDANCE}`,
	filter_by_picklist:
		`When filtering by a picklist field: 1) Call modules_fields to identify the field and confirm type is "picklist". 2) Call field_picklist_options with the document and fieldName to get the valid option keys. 3) Use the exact key value (not the translated label) in the Konecty filter format: { "match": "and", "conditions": [{ "term": "status", "operator": "equals", "value": "Ativo" }] }. For multiple values use "in": { "term": "status", "operator": "in", "value": ["Ativo", "Pendente"] }. Picklist values are restricted — only keys from field_picklist_options are accepted. ${FILTER_FORMAT_GUIDANCE} ${AUTH_GUIDANCE}`,
	filter_by_lookup:
		`When filtering by a lookup field: 1) Call modules_fields to identify the field and confirm type is "lookup". Note the "document" property which indicates the related module. 2) Call field_lookup_search with the document, fieldName, and a search term for the related record (e.g. a person's name). 3) If multiple matches are returned, present them to the user and ask which one is correct. 4) Use the confirmed _id in the Konecty filter format: { "match": "and", "conditions": [{ "term": "supplier._id", "operator": "equals", "value": "<contact_id>" }] }. For multiple IDs: { "term": "supplier._id", "operator": "in", "value": ["<id1>", "<id2>"] }. ${FILTER_FORMAT_GUIDANCE} ${AUTH_GUIDANCE}`,
};

export function registerUserPrompts(server: McpServer): void {
	for (const [name, instruction] of Object.entries(USER_PROMPTS)) {
		server.registerPrompt(
			name,
			{
				description: `User MCP prompt: ${name}`,
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
