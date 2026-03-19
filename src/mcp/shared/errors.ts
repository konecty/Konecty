import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

type McpErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'DISABLED';

const MCP_ERROR_TEXT: Record<McpErrorCode, string> = {
	UNAUTHORIZED:
		'Authentication required. This MCP is stateless: run session_login_options, then session_request_otp_email/session_request_otp_phone, and validate with session_verify_otp_email/session_verify_otp_phone; store authId; then pass it as authTokenId in every authenticated tool call. HTTP fallback is Authorization header (raw authTokenId preferred; Bearer accepted) or cookies authTokenId/_authTokenId.',
	FORBIDDEN:
		'You do not have permission to execute this operation. Ensure you are authenticated and that the authenticated user has access to this module/action.',
	VALIDATION_ERROR: 'Invalid input. Please review the parameters and try again.',
	NOT_FOUND: 'Requested resource was not found.',
	RATE_LIMITED: 'Rate limit exceeded. Please try again later.',
	INTERNAL_ERROR: 'Unexpected error while processing the MCP request.',
	DISABLED: 'This MCP endpoint is currently disabled by namespace configuration.',
};

export function toMcpErrorResult(code: McpErrorCode, details?: string): CallToolResult {
	const message = details != null && details.length > 0 ? `${MCP_ERROR_TEXT[code]} Details: ${details}` : MCP_ERROR_TEXT[code];
	return {
		isError: true,
		content: [{ type: 'text', text: message }],
		structuredContent: {
			success: false,
			error: {
				code,
				message: MCP_ERROR_TEXT[code],
				details,
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
