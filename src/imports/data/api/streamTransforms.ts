import { dateToString } from '@imports/data/dateParser';
import { DataDocument } from '@imports/types/data';
import internal, { Transform } from 'node:stream';

export class ApplyFieldPermissionsTransform extends Transform {
	private readonly accessConditions: Record<string, Function>;

	constructor(accessConditions: Record<string, Function>) {
		super({ objectMode: true });
		this.accessConditions = accessConditions;
	}

	_transform(record: DataDocument, encoding: BufferEncoding, callback: internal.TransformCallback): void {
		try {
			const filtered = Object.keys(this.accessConditions).reduce<DataDocument>((acc, key) => {
				if (this.accessConditions[key](record) === false) {
					delete acc[key];
				}
				return acc;
			}, { ...record });

			this.push(filtered);
			callback();
		} catch (error) {
			callback(error as Error);
		}
	}
}

export class ApplyDateToStringTransform extends Transform {
	constructor() {
		super({ objectMode: true });
	}

	_transform(record: DataDocument, encoding: BufferEncoding, callback: internal.TransformCallback): void {
		try {
			const transformed = dateToString(record);
			this.push(transformed);
			callback();
		} catch (error) {
			callback(error as Error);
		}
	}
}

export class ObjectToJsonTransform extends Transform {
	constructor() {
		// Input: objectMode (receives objects)
		// Output: string/buffer (produces strings)
		super({ 
			readableObjectMode: false, // Output is string/buffer
			writableObjectMode: true,  // Input is objects
		});
	}

	_transform(record: DataDocument, encoding: BufferEncoding, callback: internal.TransformCallback): void {
		try {
			const json = JSON.stringify(record) + '\n';
			this.push(json, encoding);
			callback();
		} catch (error) {
			callback(error as Error);
		}
	}
}

