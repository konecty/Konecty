import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTool } from '../../shared/registerTool';
import { fileRemove, fileUpload } from '@imports/file/file';
import { z } from 'zod';
import { AUTH_TOKEN_SCHEMA, DELETE_ANNOTATION, READ_ONLY_ANNOTATION, WRITE_ANNOTATION, authRequiredError, resolveToken } from './common';
import { toMcpErrorResult, toMcpSuccessResult } from '../../shared/errors';
import { appendNextSteps, formatKeyValues } from '../../shared/textFormatters';

type FileToolDeps = {
	authTokenId: () => string;
	baseApiUrl: string;
};

export function registerFileTools(server: McpServer, deps: FileToolDeps): void {
	registerMcpTool(server, 
		'file_upload',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Associates uploaded file metadata with a record file field. Returns: upload summary in content.text and { success, file } in structuredContent.',
			annotations: WRITE_ANNOTATION,
			inputSchema: {
				document: z.string(),
				recordId: z.string(),
				fieldName: z.string(),
				file: z.record(z.unknown()),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ document, recordId, fieldName, file, authTokenId }) => {
			const token = resolveToken(authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			const result = await fileUpload({
				authTokenId: token,
				document,
				recordCode: recordId,
				fieldName,
				body: file,
			});

			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? result.error ?? 'Upload failed'));
			}

			const text = appendNextSteps(
				`File metadata associated successfully in "${document}" record "${recordId}" field "${fieldName}".\n${formatKeyValues(result as unknown as Record<string, unknown>)}`,
				['Use records_find_by_id to verify the record now references this file.', 'Use file_download or render_file_widget for preview/download flows.'],
			);
			return toMcpSuccessResult({ file: result }, text);
		},
	);

	registerMcpTool(server, 
		'file_download',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone) to validate access and builds a file URL for preview or download. Returns: file URL in content.text and { success, fileUrl, fileName } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				document: z.string(),
				recordId: z.string(),
				fieldName: z.string(),
				fileName: z.string(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ document, recordId, fieldName, fileName, authTokenId }) => {
			if (resolveToken(authTokenId, deps.authTokenId()) == null) {
				return authRequiredError();
			}

			const fileUrl = `${deps.baseApiUrl}/rest/file/${document}/${recordId}/${fieldName}/${encodeURIComponent(fileName)}`;
			const text = appendNextSteps(
				`File URL generated.\nfileName: ${fileName}\nfileUrl: ${fileUrl}`,
				['Use render_file_widget to show preview in MCP UI.'],
			);
			return toMcpSuccessResult({ fileUrl, fileName }, text);
		},
	);

	registerMcpTool(server, 
		'file_delete',
		{
			description:
				'Requires authTokenId (from session_verify_otp_email/session_verify_otp_phone). Deletes file entry from record field. Returns: deletion summary in content.text and { success, file } in structuredContent.',
			annotations: DELETE_ANNOTATION,
			inputSchema: {
				document: z.string(),
				recordId: z.string(),
				fieldName: z.string(),
				fileName: z.string(),
				confirm: z.boolean(),
				authTokenId: AUTH_TOKEN_SCHEMA,
			},
		},
		async ({ document, recordId, fieldName, fileName, confirm, authTokenId }) => {
			const token = resolveToken(authTokenId, deps.authTokenId());
			if (token == null) {
				return authRequiredError();
			}

			if (confirm !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', 'The confirm flag must be true.');
			}

			const result = await fileRemove({
				authTokenId: token,
				document,
				recordCode: recordId,
				fieldName,
				fileName,
			});

			if (result.success !== true) {
				return toMcpErrorResult('VALIDATION_ERROR', JSON.stringify(result.errors ?? result.error ?? 'Delete failed'));
			}

			const text = `File deleted successfully.\ndocument: ${document}\nrecordId: ${recordId}\nfieldName: ${fieldName}\nfileName: ${fileName}`;
			return toMcpSuccessResult({ file: result }, text);
		},
	);

	registerMcpTool(server, 
		'render_file_widget',
		{
			description: 'Renders file preview widget. Returns: render summary in content.text and { success, fileUrl, fileName } in structuredContent.',
			annotations: READ_ONLY_ANNOTATION,
			inputSchema: {
				fileUrl: z.string(),
				fileName: z.string().optional(),
			},
			_meta: { 'ui/resourceUri': 'ui://widget/file-preview' },
		},
		async ({ fileUrl, fileName }) => toMcpSuccessResult({ fileUrl, fileName }, `Rendering file preview widget for "${fileName ?? 'unnamed-file'}".`),
	);
}
