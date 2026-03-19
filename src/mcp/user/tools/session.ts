import { Buffer } from 'node:buffer';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { registerMcpTool } from '../../shared/registerTool';
import { logout } from '@imports/auth/logout';
import { MetaObject } from '@imports/model/MetaObject';
import { z } from 'zod';
import { AUTH_TOKEN_SCHEMA, READ_ONLY_ANNOTATION, WRITE_ANNOTATION } from './common';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { appendNextSteps, formatKeyValues } from '../../shared/textFormatters';

/** Inline illustration so MCP clients can show a visual after email OTP (API returns JSON only). */
function buildOtpEmailSentIllustrationBase64(): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="140" viewBox="0 0 360 140" role="img" aria-label="E-mail">
  <rect width="360" height="140" fill="#f8fafc" rx="12"/>
  <rect x="24" y="32" width="312" height="76" fill="#fff" stroke="#e2e8f0" stroke-width="2" rx="8"/>
  <path d="M48 52 L180 92 L312 52" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="48" y="48" width="264" height="44" fill="none" stroke="#cbd5e1" stroke-width="1.5" rx="6"/>
  <text x="180" y="118" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#475569">Código enviado — verifique sua caixa de entrada</text>
</svg>`;
	return Buffer.from(svg, 'utf8').toString('base64');
}

type SessionToolDeps = {
	callAuthApi: (path: '/api/auth/request-otp' | '/api/auth/verify-otp', payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

/** E.164: + followed by country code and subscriber number (7–15 digits total after +). */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const PHONE_E164_ERROR =
	'Phone/WhatsApp OTP requires E.164 format (e.g. +5511999999999). If the user gave only DDD + local number (Brazil), prepend country code +55. Use the same normalized number in session_request_otp_phone and session_verify_otp_phone.';

/**
 * Normalizes user/agent input to E.164 for WhatsApp/phone OTP.
 * - Already +E.164: accept after stripping non-digits after +
 * - 10–11 digits without leading 55: assume Brazil → +55
 * - 12–14 digits starting with 55: prepend +
 */
function normalizePhoneToE164(raw: string): { ok: true; e164: string } | { ok: false; message: string } {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return { ok: false, message: PHONE_E164_ERROR };
	}

	if (trimmed.startsWith('+')) {
		const digits = trimmed.slice(1).replace(/\D/g, '');
		const candidate = `+${digits}`;
		if (E164_REGEX.test(candidate)) {
			return { ok: true, e164: candidate };
		}
		return { ok: false, message: `${PHONE_E164_ERROR} Received (after +): invalid length or format.` };
	}

	const digits = trimmed.replace(/\D/g, '');
	if (digits.length === 0) {
		return { ok: false, message: PHONE_E164_ERROR };
	}

	if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
		const candidate = `+55${digits}`;
		if (E164_REGEX.test(candidate)) {
			return { ok: true, e164: candidate };
		}
	}

	if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 14) {
		const candidate = `+${digits}`;
		if (E164_REGEX.test(candidate)) {
			return { ok: true, e164: candidate };
		}
	}

	return { ok: false, message: PHONE_E164_ERROR };
}

function parseRequiredString(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function parseVerifyOtpResult(result: Record<string, unknown>) {
	const authId = typeof result.authId === 'string' ? result.authId : '';
	const user = typeof result.user === 'object' && result.user != null ? (result.user as Record<string, unknown>) : {};
	return {
		authId,
		user,
		logged: result.logged === true,
	};
}

function buildVerifySuccessMessage(authId: string, user: Record<string, unknown>): string {
	const userName = typeof user.name === 'string' ? user.name : 'User';
	const userEmail = typeof user.email === 'string' ? user.email : '';
	const userLabel = userEmail.length > 0 ? `${userName} (${userEmail})` : userName;
	return (
		`Authentication successful. Store this authId and pass it as authTokenId in all authenticated tools.\n` +
		`authId: ${authId}\n` +
		`user: ${userLabel}`
	);
}

export function registerSessionTools(server: McpServer, deps: SessionToolDeps): void {
	registerMcpTool(server, 
		'session_login_options',
		{
			description:
				'Returns available login methods and next-step instructions for OTP flow. Returns: options and guidance in content.text and { success, options, nextSteps, requestOtpExamples, verifyOtpExamples } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
		},
		async () => {
			const otpConfig = MetaObject.Namespace.otpConfig;
			const emailOtpEnabled = (otpConfig?.emailTemplateId != null && otpConfig.emailTemplateId !== '') || process.env.OTP_EMAIL_ENABLED === 'true';
			const whatsAppOtpEnabled = otpConfig?.whatsapp != null || process.env.OTP_WHATSAPP_ENABLED === 'true';

			const payload = {
				options: {
					passwordEnabled: true,
					emailOtpEnabled,
					whatsAppOtpEnabled,
				},
				nextSteps: [
					'If e-mail OTP is enabled, call session_request_otp_email with a non-empty email.',
					'If phone/WhatsApp OTP is enabled, call session_request_otp_phone with phoneNumber in E.164 (e.g. +5511999999999). If the user only provides DDD + number (Brazil), prepend +55.',
					'Call session_verify_otp_email or session_verify_otp_phone matching the channel used to request OTP.',
					'Store authId from session_verify_otp_email/session_verify_otp_phone and pass it as authTokenId in authenticated tools.',
				],
				requestOtpExamples: {
					email: { tool: 'session_request_otp_email', payload: { email: 'support@konecty.com' } },
					phone: { tool: 'session_request_otp_phone', payload: { phoneNumber: '+5511999999999' } },
				},
				verifyOtpExamples: {
					email: { tool: 'session_verify_otp_email', payload: { email: 'support@konecty.com', otpCode: '123456' } },
					phone: { tool: 'session_verify_otp_phone', payload: { phoneNumber: '+5511999999999', otpCode: '123456' } },
				},
			};
			const text = appendNextSteps(
				`Login options loaded.\n${formatKeyValues(payload.options)}`,
				payload.nextSteps,
			);
			return toMcpSuccessResult(
				{
					...payload,
				},
				text,
			);
		},
	);

	registerMcpTool(
		server,
		'session_request_otp_email',
		{
			description:
				'Requests OTP delivery using e-mail only. Use this tool when OTP channel is e-mail. On success, the result includes a small illustration image for the chat UI. Returns: OTP request summary in content.text and { success, otpRequest, channel, nextStep } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				email: z.string(),
			},
		},
		async args => {
			try {
				const email = parseRequiredString(args.email);
				if (email == null) {
					return toMcpErrorResult('VALIDATION_ERROR', 'email must be a non-empty string.');
				}

				const result = (await deps.callAuthApi('/api/auth/request-otp', { email })) as Record<string, unknown> & {
					success?: boolean;
					errors?: unknown;
					message?: string;
				};
				if (result.success !== true) {
					return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? result.message ?? result));
				}

				const toolResult: CallToolResult = {
					content: [
						{
							type: 'text',
							text: `OTP enviado para ${email}. Quando receber o e-mail, informe o código de 6 dígitos usando session_verify_otp_email. / OTP sent to ${email}. Enter the 6-digit code using session_verify_otp_email.`,
						},
						{
							type: 'image',
							data: buildOtpEmailSentIllustrationBase64(),
							mimeType: 'image/svg+xml',
						},
					],
					structuredContent: {
						success: true,
						otpRequest: result,
						channel: 'email',
						nextStep: 'Call session_verify_otp_email with otpCode and the same email.',
					},
				};
				return toolResult;
			} catch (error) {
				return toMcpErrorResult('INTERNAL_ERROR', (error as Error).message);
			}
		},
	);

	registerMcpTool(
		server,
		'session_request_otp_phone',
		{
			description:
				'Requests OTP delivery using phoneNumber only (phone/WhatsApp). phoneNumber MUST be E.164 (e.g. +5511999999999). If the user gives only Brazilian DDD + number (10–11 digits), prepend +55 before calling. Use the same normalized value for session_verify_otp_phone. Returns: OTP request summary in content.text and { success, otpRequest, channel, nextStep, normalizedPhoneNumber } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				phoneNumber: z
					.string()
					.describe(
						'E.164 international number, e.g. +5511999999999. For Brazil without country code (DDD + number only), the server normalizes by adding +55 when possible.',
					),
			},
		},
		async args => {
			try {
				const rawPhone = parseRequiredString(args.phoneNumber);
				if (rawPhone == null) {
					return toMcpErrorResult('VALIDATION_ERROR', 'phoneNumber must be a non-empty string.');
				}

				const normalized = normalizePhoneToE164(rawPhone);
				if (!normalized.ok) {
					return toMcpErrorResult('VALIDATION_ERROR', normalized.message);
				}
				const phoneNumber = normalized.e164;

				const result = (await deps.callAuthApi('/api/auth/request-otp', { phoneNumber })) as Record<string, unknown> & {
					success?: boolean;
					errors?: unknown;
					message?: string;
				};
				if (result.success !== true) {
					return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? result.message ?? result));
				}

				const text = appendNextSteps(
					`OTP request submitted for E.164 phoneNumber "${phoneNumber}".${rawPhone !== phoneNumber ? ` (normalized from "${rawPhone}")` : ''}`,
					['Check your phone/WhatsApp for the OTP code.', `Call session_verify_otp_phone with otpCode and phoneNumber "${phoneNumber}" (same E.164 as here).`],
				);
				return toMcpSuccessResult(
					{
						otpRequest: result,
						channel: 'phone' as const,
						normalizedPhoneNumber: phoneNumber,
						nextStep: `Call session_verify_otp_phone with otpCode and phoneNumber "${phoneNumber}".`,
					},
					text,
				);
			} catch (error) {
				return toMcpErrorResult('INTERNAL_ERROR', (error as Error).message);
			}
		},
	);

	registerMcpTool(
		server,
		'session_verify_otp_email',
		{
			description:
				'Validates OTP code for e-mail channel. Returns authId that must be stored by the client and passed as authTokenId in authenticated tools. This MCP is stateless. Returns: auth summary in content.text and { success, authId, user, logged, instructions } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				email: z.string(),
				otpCode: z.string(),
			},
		},
		async args => {
			try {
				const email = parseRequiredString(args.email);
				if (email == null) {
					return toMcpErrorResult('VALIDATION_ERROR', 'email must be a non-empty string.');
				}

				const otpCode = parseRequiredString(args.otpCode);
				if (otpCode == null) {
					return toMcpErrorResult('VALIDATION_ERROR', 'otpCode must be a non-empty string.');
				}

				const result = (await deps.callAuthApi('/api/auth/verify-otp', { email, otpCode })) as Record<string, unknown> & {
					success?: boolean;
					errors?: unknown;
				};
				if (result.success !== true) {
					return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
				}

				const parsed = parseVerifyOtpResult(result);
				if (parsed.authId.length === 0) {
					return toMcpErrorResult('INTERNAL_ERROR', 'OTP verified but authId was not returned.');
				}

				return toMcpSuccessResult(
					{
						authId: parsed.authId,
						user: parsed.user,
						logged: parsed.logged,
						instructions: 'Store authId and pass it as authTokenId in each authenticated tool call.',
					},
					buildVerifySuccessMessage(parsed.authId, parsed.user),
				);
			} catch (error) {
				return toMcpErrorResult('INTERNAL_ERROR', (error as Error).message);
			}
		},
	);

	registerMcpTool(
		server,
		'session_verify_otp_phone',
		{
			description:
				'Validates OTP code for phone/WhatsApp. phoneNumber MUST be the same E.164 value used in session_request_otp_phone (e.g. +5511999999999). If the user gave only DDD + number, normalize with +55 (Brazil) the same way as on request. Returns authId for authTokenId on protected tools. This MCP is stateless.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				phoneNumber: z
					.string()
					.describe('E.164 phone number; must match normalized value from session_request_otp_phone (e.g. +5511999999999).'),
				otpCode: z.string(),
			},
		},
		async args => {
			try {
				const rawPhone = parseRequiredString(args.phoneNumber);
				if (rawPhone == null) {
					return toMcpErrorResult('VALIDATION_ERROR', 'phoneNumber must be a non-empty string.');
				}

				const normalized = normalizePhoneToE164(rawPhone);
				if (!normalized.ok) {
					return toMcpErrorResult('VALIDATION_ERROR', normalized.message);
				}
				const phoneNumber = normalized.e164;

				const otpCode = parseRequiredString(args.otpCode);
				if (otpCode == null) {
					return toMcpErrorResult('VALIDATION_ERROR', 'otpCode must be a non-empty string.');
				}

				const result = (await deps.callAuthApi('/api/auth/verify-otp', { phoneNumber, otpCode })) as Record<string, unknown> & {
					success?: boolean;
					errors?: unknown;
				};
				if (result.success !== true) {
					return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? []));
				}

				const parsed = parseVerifyOtpResult(result);
				if (parsed.authId.length === 0) {
					return toMcpErrorResult('INTERNAL_ERROR', 'OTP verified but authId was not returned.');
				}

				return toMcpSuccessResult(
					{
						authId: parsed.authId,
						user: parsed.user,
						logged: parsed.logged,
						instructions: 'Store authId and pass it as authTokenId in each authenticated tool call.',
					},
					buildVerifySuccessMessage(parsed.authId, parsed.user),
				);
			} catch (error) {
				return toMcpErrorResult('INTERNAL_ERROR', (error as Error).message);
			}
		},
	);

	registerMcpTool(server, 
		'session_logout',
		{
			description:
				'Invalidates authTokenId on the server (removes token from database). The client must also discard the local token. Requires authTokenId. Returns: logout summary in content.text and { success, logout } in structuredContent.',
			annotations: WRITE_ANNOTATION,
			inputSchema: {
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ authTokenId }) => {
			if (authTokenId == null || authTokenId.trim().length === 0) {
				return toMcpErrorResult('VALIDATION_ERROR', 'authTokenId is required.');
			}

			const result = await logout(authTokenId);
			if (result?.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result?.errors ?? [{ message: 'Logout failed.' }]));
			}

			const text = appendNextSteps(
				'Token invalidated on server.',
				['Discard authTokenId on client side.', 'Call session_request_otp_email/session_request_otp_phone again when you need a new authenticated session.'],
			);
			return toMcpSuccessResult({ logout: true }, text);
		},
	);
}
