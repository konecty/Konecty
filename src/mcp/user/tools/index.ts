import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFieldLookupTools } from './fieldLookup';
import { registerFileTools } from './files';
import { registerModuleTools } from './modules';
import { registerQueryTools } from './query';
import { registerRecordTools } from './records';
import { registerSessionTools } from './session';

type UserToolDeps = {
	authTokenId: () => string;
	user: () => Record<string, unknown>;
	baseUiUrl: string;
	baseApiUrl: string;
	callAuthApi: (path: '/api/auth/request-otp' | '/api/auth/verify-otp', payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export function registerUserTools(server: McpServer, deps: UserToolDeps): void {
	registerSessionTools(server, {
		callAuthApi: deps.callAuthApi,
	});

	registerModuleTools(server, {
		authTokenId: deps.authTokenId,
		user: deps.user,
	});

	registerRecordTools(server, {
		authTokenId: deps.authTokenId,
		baseUiUrl: deps.baseUiUrl,
	});

	registerQueryTools(server, {
		authTokenId: deps.authTokenId,
	});

	registerFileTools(server, {
		authTokenId: deps.authTokenId,
		baseApiUrl: deps.baseApiUrl,
	});

	registerFieldLookupTools(server, {
		authTokenId: deps.authTokenId,
	});
}
