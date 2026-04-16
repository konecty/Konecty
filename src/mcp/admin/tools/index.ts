import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMetaAccessTool } from './metaAccess';
import { registerMetaDoctorTool } from './metaDoctor';
import { registerMetaDocumentTool } from './metaDocument';
import { registerMetaHookTool } from './metaHook';
import { registerMetaListTool } from './metaList';
import { registerMetaNamespaceTool } from './metaNamespace';
import { registerMetaPivotTool } from './metaPivot';
import { registerMetaReadTool } from './metaRead';
import { registerMetaSyncTool } from './metaSync';
import { registerMetaViewTool } from './metaView';

type AdminToolDeps = {
	user: () => Record<string, unknown>;
};

export function registerAdminTools(server: McpServer, deps: AdminToolDeps): void {
	registerMetaReadTool(server, deps);
	registerMetaDocumentTool(server, deps);
	registerMetaListTool(server, deps);
	registerMetaViewTool(server, deps);
	registerMetaAccessTool(server, deps);
	registerMetaHookTool(server, deps);
	registerMetaNamespaceTool(server, deps);
	registerMetaPivotTool(server, deps);
	registerMetaDoctorTool(server);
	registerMetaSyncTool(server, deps);
}
