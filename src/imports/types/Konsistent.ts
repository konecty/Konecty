export type LogDocument = {
	_id: string;
	dataId: string;
	metaName: string;
	operation: string;
	data: Record<string, any>;
	userId: string;
	ts: Date;
};
