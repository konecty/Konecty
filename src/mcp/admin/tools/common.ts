import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

export const ADMIN_READ_ANNOTATION: ToolAnnotations = {
	readOnlyHint: true,
	openWorldHint: false,
	destructiveHint: false,
};

export const ADMIN_WRITE_ANNOTATION: ToolAnnotations = {
	readOnlyHint: false,
	openWorldHint: false,
	destructiveHint: false,
};
