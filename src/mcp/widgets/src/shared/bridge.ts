export type WidgetPayload = Record<string, unknown>;

declare global {
	interface Window {
		__MCP_TOOL_RESULT__?: WidgetPayload;
		openai?: {
			openExternal?: (url: string) => void;
		};
	}
}

export function getWidgetPayload<T extends WidgetPayload = WidgetPayload>(): T {
	return (window.__MCP_TOOL_RESULT__ ?? {}) as T;
}

export function openExternalLink(url: string): void {
	if (window.openai?.openExternal != null) {
		window.openai.openExternal(url);
		return;
	}

	window.open(url, '_blank', 'noopener,noreferrer');
}
