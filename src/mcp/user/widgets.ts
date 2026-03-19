import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// MCP Apps MIME type — defined inline to avoid ESM-only @modelcontextprotocol/ext-apps
const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

const WIDGET_DIST = resolve(process.cwd(), 'src/mcp/widgets/dist');

const WIDGETS = [
	{ name: 'records-table', uri: 'ui://widget/records-table' },
	{ name: 'pivot', uri: 'ui://widget/pivot' },
	{ name: 'graph', uri: 'ui://widget/graph' },
	{ name: 'record-detail', uri: 'ui://widget/record-detail' },
	{ name: 'record-card', uri: 'ui://widget/record-card' },
	{ name: 'file-preview', uri: 'ui://widget/file-preview' },
];

function renderWidgetHtml(jsBundle: string): string {
	return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <div id="root"></div>
  <script type="module">
${jsBundle}
  </script>
</body>
</html>
	`.trim();
}

export function registerUserWidgetResources(server: McpServer): void {
	for (const widget of WIDGETS) {
		server.registerResource(
			widget.name,
			widget.uri,
			{ mimeType: RESOURCE_MIME_TYPE },
			async () => {
				const jsBundle = readFileSync(resolve(WIDGET_DIST, `${widget.name}.js`), 'utf8');
				return {
					contents: [
						{
							uri: widget.uri,
							mimeType: RESOURCE_MIME_TYPE,
							text: renderWidgetHtml(jsBundle),
						},
					],
				};
			},
		);
	}
}
