import { errorReturn, successReturn } from '@imports/utils/return';

import { ExportDataResponse, TransformFlattenData } from '@imports/data/export';
import { KonectyResult } from '@imports/types/result';
import fs from 'fs';
import internal, { Transform } from 'node:stream';
import { Readable } from 'stream';

export default async function csvExport(dataStream: Readable, name: string): Promise<KonectyResult<ExportDataResponse>> {
	const filename = `/tmp/${name}_${Date.now()}`;

	const flattenData = new TransformFlattenData();
	const toCSV = new TransformToCSV(flattenData);
	const addHeaders = new TransformAddHeaders(toCSV);
	const fileWriteStream = fs.createWriteStream(filename);

	// Write to a tmp file so we can get all headers, then stream it back to response
	dataStream.pipe(flattenData).pipe(toCSV).pipe(fileWriteStream);

	return new Promise(resolve => {
		fileWriteStream.on('finish', () => {
			const readStream = fs.createReadStream(filename);
			readStream.on('end', () => {
				fs.unlinkSync(filename);
			});

			resolve(
				successReturn({
					httpHeaders: {
						'Content-Type': 'application/csv',
						'Content-Disposition': `attachment; filename=${name}.csv`,
					},
					content: readStream.pipe(addHeaders),
				}),
			);
		});

		fileWriteStream.on('error', () => {
			resolve(errorReturn('Error writing file'));
		});
	});
}

class TransformToCSV extends Transform {
	flatDataBase: TransformFlattenData;

	constructor(flatDataBase: TransformFlattenData) {
		super({ objectMode: true, defaultEncoding: 'utf8' });
		this.flatDataBase = flatDataBase;
	}

	_transform(record: Record<string, unknown>, encoding: string, callback: internal.TransformCallback) {
		const headers = this.getHeaders();

		const values = Array.from(headers).map(header => (record[header] ? `"${record[header]}"` : ''));
		this.push(values.join(',') + '\n');

		callback();
	}

	getHeaders() {
		return this.flatDataBase.headers;
	}
}

class TransformAddHeaders extends Transform {
	headersAdded = false;
	toCsvBase: TransformToCSV;

	constructor(toCsvBase: TransformToCSV) {
		super({ objectMode: true, defaultEncoding: 'utf8' });
		this.toCsvBase = toCsvBase;
	}

	_transform(record: Record<string, unknown>, encoding: string, callback: internal.TransformCallback) {
		if (this.headersAdded === false) {
			const headers = this.toCsvBase.getHeaders();

			this.push(Array.from(headers).join(',') + '\n');
			this.headersAdded = true;
		}

		this.push(record);
		callback();
	}
}
