export type DataDocument = Record<string, unknown> & { _id: string };

export type HistoryDocument = {
	dataId: string;
	createdAt: Date;
	data: Record<string, unknown>;
};
