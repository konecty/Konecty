import { successReturn } from '@imports/utils/return';
import { ExportDataResponse } from '@imports/data/export';
import { KonectyResult } from '@imports/types/result';
import internal, { Transform } from 'node:stream';
import { Readable } from 'stream';

/**
 * Convert objects to NDJSON format (one JSON object per line).
 * Input: objectMode stream
 * Output: string/buffer mode with newline-delimited JSON
 */
class TransformObjectToNDJSON extends Transform {
	constructor() {
		super({
			readableObjectMode: false, // Output is string/buffer
			writableObjectMode: true, // Input is objects
		});
	}

	_transform(record: Record<string, unknown>, encoding: BufferEncoding, callback: internal.TransformCallback): void {
		try {
			const json = JSON.stringify(record) + '\n';
			this.push(json, encoding);
			callback();
		} catch (error) {
			callback(error as Error);
		}
	}
}

/**
 * Export data as NDJSON (newline-delimited JSON).
 * Each line is a complete JSON object.
 */
export default async function jsonExport(dataStream: Readable, name: string): Promise<KonectyResult<ExportDataResponse>> {
	const ndjsonTransform = new TransformObjectToNDJSON();

	return successReturn({
		httpHeaders: {
			'Content-Type': 'application/x-ndjson',
			'Content-Disposition': `attachment; filename=${name}.ndjson`,
		},
		content: dataStream.pipe(ndjsonTransform),
	});
}
