export type DataDocument<Model = Record<string, unknown>> = Model & { _id: string };

export type HistoryDocument = Record<string, unknown> & {
	dataId: string;
	createdAt: Date;
	data: Record<string, unknown>;
};
