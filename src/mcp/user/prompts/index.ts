import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const AUTH_GUIDANCE =
	'This MCP is stateless. For protected tools, first run OTP flow, store authId from session_verify_otp_email/session_verify_otp_phone, and pass it as authTokenId argument in every authenticated tool call. HTTP fallback is Authorization header (raw authTokenId preferred; Bearer accepted) or cookies authTokenId/_authTokenId.';

const OTP_INPUT_GUIDANCE =
	'For OTP flow, use channel-specific tools: session_request_otp_email/session_verify_otp_email or session_request_otp_phone/session_verify_otp_phone. Never mix channels.';

const PHONE_OTP_E164_GUIDANCE =
	'Phone/WhatsApp OTP: phoneNumber must be E.164 (e.g. +5511999999999). If the user only gives Brazilian DDD + local number, prepend +55. Use the same normalized E.164 string in session_request_otp_phone and session_verify_otp_phone.';

const CONTROL_FIELDS_GUIDANCE =
	'Every Konecty module has system/control fields (prefixed with _). ' +
	'_id: type ObjectId, operators: equals/in/not_in. ' +
	'_createdAt/_updatedAt: type dateTime, values MUST be ISO 8601 (e.g. "2026-03-18T00:00:00Z"), operators: equals/greater_than/less_than/greater_or_equals/less_or_equals/between. ' +
	'_user: type lookup array to User, filter path "_user._id", operators: equals/in. Use current_user operator (no value) to match the authenticated user. ' +
	'_createdBy/_updatedBy: type lookup to User, filter path "_createdBy._id"/"_updatedBy._id", operators: equals/in. ' +
	'All date/dateTime values must be ISO 8601 with timezone (e.g. "2026-01-01T00:00:00Z"), never "2026-01-01" or "01/01/2026".';

const OPERATORS_BY_TYPE_GUIDANCE =
	'Operators by field type: ' +
	'text/url/email.address: equals, not_equals, in, not_in, contains, not_contains, starts_with, end_with, exists. ' +
	'number/autoNumber/percentage/money.value: equals, not_equals, in, not_in, less_than, greater_than, less_or_equals, greater_or_equals, between, exists. ' +
	'date/dateTime: equals, not_equals, in, not_in, less_than, greater_than, less_or_equals, greater_or_equals, between, exists. Values must be ISO 8601. ' +
	'boolean: equals, not_equals, exists. ' +
	'picklist: equals, not_equals, in, not_in, exists. Use exact key from field_picklist_options. ' +
	'lookup._id: equals, not_equals, in, not_in, exists. Use _id from field_lookup_search. ' +
	'ObjectId (_id field): equals, not_equals, in, not_in, exists. ' +
	'personName.first/last/full: equals, not_equals, contains, not_contains, starts_with, end_with, exists. ' +
	'phone.phoneNumber: equals, not_equals, in, not_in, contains, starts_with, exists.';

const FILTER_FORMAT_GUIDANCE =
	'Filters are OPTIONAL. To fetch all records, simply omit the filter parameter — do NOT call filter_build with empty conditions. ' +
	'When you DO need to filter, call filter_build with conditions: [{ field, operator, value, fieldType? }]. ' +
	'Pass the returned filter object directly to records_find, query_pivot, or query_graph. ' +
	'If filter_build rejects an operator, check the operators-by-type reference for valid operators. ' +
	'Handcrafting filter JSON is not allowed. Mongo-style filters ({ "field": "value" } or $gte/$lte) are rejected by the server. ' +
	'Lookup filters use path "fieldName._id". Nested OR uses "filters" array inside filter_build.';

const PAGINATION_GUIDANCE =
	'records_find uses offset-based pagination. Default page size: 50. ' +
	'Parameters: start (offset, default 0), limit (page size). Response always includes total (full count). ' +
	'Strategy for large datasets: ' +
	'1) First call: records_find with limit (e.g. 50). Check total in response. ' +
	'2) If total > limit, iterate: next call with start = previous start + limit. ' +
	'3) Stop when start >= total. ' +
	'Example: total=120, limit=50 → page 1: start=0, page 2: start=50, page 3: start=100. ' +
	'When limit > 1000, sort is forced to _id for stable ordering. ' +
	'For aggregated summaries (counts, sums, averages) across large datasets, prefer query_json with groupBy/aggregators instead of paginating all records.';

const CROSS_MODULE_QUERY_GUIDANCE =
	'query_json is the primary tool for cross-module retrievals and aggregation. ' +
	'The query object structure: ' +
	'{ document: "<module>", filter?: <from filter_build>, fields?: "field1,field2", sort?: [{ property, direction }], ' +
	'limit?: number (default 1000, max 100000), start?: number, ' +
	'relations?: [<relation>], groupBy?: ["field1", "field2"], aggregators?: { <alias>: { aggregator, field? } }, ' +
	'includeTotal?: boolean (default true), includeMeta?: boolean }. ' +
	'RELATIONS: Join child modules to the parent. Each relation: ' +
	'{ document: "<child module>", lookup: "<lookup field pointing to parent>", filter?: <filter>, fields?: "f1,f2", ' +
	'sort?: [...], limit?: number, aggregators: { <alias>: { aggregator: "<name>", field?: "<fieldName>" } } }. ' +
	'Each relation MUST have at least one aggregator. Max 10 relations, max nesting depth 2. ' +
	'AGGREGATORS (root-level and relation-level): ' +
	'count (no field needed), countDistinct (field required), sum (field required), avg (field required), ' +
	'min (field required), max (field required), first (field optional), last (field optional), ' +
	'push (field optional — returns array), addToSet (field required — unique values). ' +
	'GROUPBY: Use root-level groupBy with aggregators for consolidated results. ' +
	'Example — count opportunities per contact: ' +
	'{ document: "Contact", fields: "code,name", relations: [{ document: "Opportunity", lookup: "contact", ' +
	'aggregators: { totalOpportunities: { aggregator: "count" }, totalValue: { aggregator: "sum", field: "value.value" } } }] }. ' +
	'Example — group contacts by status with count: ' +
	'{ document: "Contact", groupBy: ["status"], aggregators: { total: { aggregator: "count" } } }. ' +
	'For numeric aggregations (sum/avg/min/max), money fields use path "fieldName.value". ' +
	'Use query_sql only when the user explicitly asks for SQL syntax.';

const USER_PROMPTS: Record<string, string> = {
	authenticate:
		`Use session_login_options to inspect available auth methods. If email OTP is enabled, call session_request_otp_email and then session_verify_otp_email. If phone/WhatsApp OTP is enabled, call session_request_otp_phone and then session_verify_otp_phone. ${PHONE_OTP_E164_GUIDANCE} Store authId returned by the verify tool and pass it as authTokenId in every protected tool call. OTP-only flow must be respected. ${OTP_INPUT_GUIDANCE} ${AUTH_GUIDANCE}`,
	find_records:
		'Step-by-step workflow to find records: ' +
		'1) Call modules_list — pick modules[].document (technical _id, never label). ' +
		'2) Call modules_fields — inspect field types and the controlFields section for system fields. ' +
		'3) If you need to filter: for picklist fields, call field_picklist_options first; for lookup fields, call field_lookup_search first; then call filter_build with conditions. ' +
		'4) Call records_find with document. If you have a filter from step 3, pass it. If you want ALL records, simply omit the filter parameter — do NOT create an empty or dummy filter. ' +
		'5) Check response total — if more records exist, paginate with start/limit. ' +
		`${CONTROL_FIELDS_GUIDANCE} ${OPERATORS_BY_TYPE_GUIDANCE} ${FILTER_FORMAT_GUIDANCE} ${PAGINATION_GUIDANCE} ` +
		'Sort format: [{"property":"_createdAt","direction":"DESC"}] (or "term" instead of "property"). Never use Mongo sort like {"_createdAt":-1}. ' +
		`Use records_find for single-module reads. For aggregated totals/sums across modules, use query_json with aggregators. ${AUTH_GUIDANCE}`,
	create_record:
		`First resolve the document via modules_list.modules[].document (_id, not label/name). Inspect fields with modules_fields, validate required values and lookups, then execute records_create. Return created identifiers and key fields. ${AUTH_GUIDANCE}`,
	update_record:
		`Resolve document via modules_list.modules[].document (_id, not label/name). Then call records_find_by_id to fetch latest _updatedAt, and call records_update with ids including _id and _updatedAt to preserve optimistic locking. ${AUTH_GUIDANCE}`,
	delete_record:
		`Resolve document via modules_list.modules[].document (_id, not label/name). Always call records_delete_preview first, present deletion impact, require explicit confirmation, then call records_delete with confirm=true and one record per request. ${AUTH_GUIDANCE}`,
	cross_module_query:
		'Step-by-step workflow for cross-module queries and aggregation: ' +
		'1) Call modules_list — resolve technical _id for all involved modules (never use label/name). ' +
		'2) Call modules_fields for each module to inspect field types, lookup targets, and control fields. ' +
		'3) Build filters with filter_build if needed. ' +
		'4) Construct query_json query object with relations, groupBy, and aggregators as needed. ' +
		`${CROSS_MODULE_QUERY_GUIDANCE} ${FILTER_FORMAT_GUIDANCE} ${CONTROL_FIELDS_GUIDANCE} ${AUTH_GUIDANCE}`,
	build_pivot:
		'Prepare rows, columns, values and filters for aggregation. ' +
		`${FILTER_FORMAT_GUIDANCE} ${CONTROL_FIELDS_GUIDANCE} ` +
		`Run query_pivot, inspect output, and call render_pivot_widget for visual output. ${AUTH_GUIDANCE}`,
	build_graph:
		'Define graphConfig for axes and aggregation. ' +
		`${FILTER_FORMAT_GUIDANCE} ${CONTROL_FIELDS_GUIDANCE} ` +
		`Run query_graph, and call render_graph_widget to display SVG output. ${AUTH_GUIDANCE}`,
	upload_file:
		`Upload binary using platform upload flow, then call file_upload with file metadata payload and link it to the record field. Use records_update for additional associations when necessary. ${AUTH_GUIDANCE}`,
	filter_by_picklist:
		'When filtering by a picklist field: ' +
		'1) Call modules_fields to confirm field type is "picklist". ' +
		'2) Call field_picklist_options to get valid keys. ' +
		'3) Call filter_build with fieldType: "picklist", operator: "equals" (single) or "in" (multiple), value: exact key(s) from field_picklist_options. ' +
		`Picklist values are restricted — only keys from field_picklist_options are accepted. ${FILTER_FORMAT_GUIDANCE} ${AUTH_GUIDANCE}`,
	filter_by_lookup:
		'When filtering by a lookup field: ' +
		'1) Call modules_fields to confirm field type is "lookup". Note the "document" property (related module). ' +
		'2) Call field_lookup_search with document, fieldName, and search term. ' +
		'3) If multiple matches, ask the user which is correct. ' +
		'4) Call filter_build with field: "<lookupField>._id", fieldType: "lookup._id", operator: "equals" or "in", value: confirmed _id(s). ' +
		`${FILTER_FORMAT_GUIDANCE} ${AUTH_GUIDANCE}`,
	build_filter:
		'filter_build is only needed when you have specific conditions to apply. To fetch ALL records, omit the filter parameter entirely in records_find/query_pivot/query_graph. ' +
		`When filtering, provide conditions with field, operator, value, and optionally fieldType for operator validation. ${OPERATORS_BY_TYPE_GUIDANCE} ${FILTER_FORMAT_GUIDANCE}`,
};

export { CONTROL_FIELDS_GUIDANCE, OPERATORS_BY_TYPE_GUIDANCE, FILTER_FORMAT_GUIDANCE, PAGINATION_GUIDANCE, CROSS_MODULE_QUERY_GUIDANCE };

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
