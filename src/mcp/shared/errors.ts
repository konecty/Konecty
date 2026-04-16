import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

type McpErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'DISABLED';

const MCP_ERROR_TEXT: Record<McpErrorCode, string> = {
	UNAUTHORIZED:
		'Authentication required. This MCP is stateless: run session_login_options, then session_request_otp_email/session_request_otp_phone, and validate with session_verify_otp_email/session_verify_otp_phone; store authId; then pass it as authTokenId in every authenticated tool call. HTTP fallback is Authorization header (raw authTokenId preferred; Bearer accepted) or cookies authTokenId/_authTokenId.',
	FORBIDDEN:
		'You do not have permission to execute this operation. Ensure you are authenticated and that the authenticated user has access to this module/action.',
	VALIDATION_ERROR: 'Invalid input. Review the parameters and follow the recovery steps below.',
	NOT_FOUND: 'Requested resource was not found. Verify the document _id from modules_list and the record _id.',
	RATE_LIMITED: 'Rate limit exceeded. Wait a moment and try again.',
	INTERNAL_ERROR: 'Unexpected error while processing the MCP request.',
	DISABLED: 'This MCP endpoint is currently disabled by namespace configuration.',
};

type RecoverySteps = string | string[];

function formatRecovery(recovery: RecoverySteps | undefined): string {
	if (recovery == null) {
		return '';
	}
	const steps = Array.isArray(recovery) ? recovery : [recovery];
	if (steps.length === 0) {
		return '';
	}
	if (steps.length === 1) {
		return ` Recovery: ${steps[0]}`;
	}
	return ` Recovery:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
}

export function toMcpErrorResult(code: McpErrorCode, details?: string, recovery?: RecoverySteps): CallToolResult {
	const recoveryText = formatRecovery(recovery);
	const detailsPart = details != null && details.length > 0 ? ` Details: ${details}` : '';
	const message = `${MCP_ERROR_TEXT[code]}${detailsPart}${recoveryText}`;
	return {
		isError: true,
		content: [{ type: 'text', text: message }],
		structuredContent: {
			success: false,
			error: {
				code,
				message: MCP_ERROR_TEXT[code],
				details,
				...(recovery != null ? { recovery: Array.isArray(recovery) ? recovery : [recovery] } : {}),
			},
		},
	};
}

export function toMcpSuccessResult<T extends Record<string, unknown>>(data: T, text: string): CallToolResult {
	return {
		content: [{ type: 'text', text }],
		structuredContent: {
			success: true,
			...data,
		},
	};
}
