import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { toMcpErrorResult } from '../../shared/errors';

export const READ_ONLY_ANNOTATION: ToolAnnotations = {
	readOnlyHint: true,
	openWorldHint: false,
	destructiveHint: false,
};

export const WRITE_ANNOTATION: ToolAnnotations = {
	readOnlyHint: false,
	openWorldHint: false,
	destructiveHint: false,
};

export const DELETE_ANNOTATION: ToolAnnotations = {
	readOnlyHint: false,
	openWorldHint: false,
	destructiveHint: true,
};

export const AUTH_TOKEN_SCHEMA = z
	.string()
	.optional()
	.describe(
		'Authentication token returned as authId by session_verify_otp_email or session_verify_otp_phone. Required for authenticated tools in this stateless MCP.',
	);

function normalizeToken(token: string | undefined): string | undefined {
	if (token == null) {
		return undefined;
	}

	const trimmed = token.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveToken(argsToken: string | undefined, fallbackToken: string | undefined): string | undefined {
	return normalizeToken(argsToken) ?? normalizeToken(fallbackToken);
}

export function authRequiredError() {
	return toMcpErrorResult(
		'UNAUTHORIZED',
		'This MCP is stateless. Run session_login_options, then session_request_otp_email/session_request_otp_phone, and validate with session_verify_otp_email/session_verify_otp_phone. Store the returned authId and pass it as authTokenId on every authenticated tool call.',
	);
}
