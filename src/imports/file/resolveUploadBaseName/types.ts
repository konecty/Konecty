export type ResolveUploadBaseNameParams = {
	document: string;
	recordId: string;
	fieldName: string;
	/** Basename sem extensão quando nenhuma estratégia se aplica (p.ex. hash do conteúdo). */
	fallback: string;
};

/** Estratégia de basename: `null` = não se aplica (seguinte em lista); `string` = usa este stem. */
export type UploadBaseNameStrategy = (params: ResolveUploadBaseNameParams) => Promise<string | null>;
