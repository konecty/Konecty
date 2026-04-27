import { logger } from '@imports/utils/logger';
import { tryOfficeAgencyBrandingUploadBaseName } from './strategies/tryOfficeAgencyBrandingUploadBaseName';
import type { ResolveUploadBaseNameParams, UploadBaseNameStrategy } from './types';

export type { ResolveUploadBaseNameParams, UploadBaseNameStrategy } from './types';

const uploadBaseNameStrategies: ReadonlyArray<UploadBaseNameStrategy> = [tryOfficeAgencyBrandingUploadBaseName];

/**
 * Basename (sem extensão) a gravar no storage. Consulta, em ordem, estratégias em `strategies/`;
 * a primeira a devolver uma string não vazia ganha. Caso nenhuma seja aplicável, `fallback` (p.ex. hash).
 */
export async function resolveUploadBaseName(params: ResolveUploadBaseNameParams): Promise<string> {
	for (const run of uploadBaseNameStrategies) {
		try {
			const out = await run(params);
			if (typeof out === 'string' && out !== '') {
				return out;
			}
		} catch (error) {
			logger.error(error, 'resolveUploadBaseName: strategy failed');
		}
	}
	return params.fallback;
}
