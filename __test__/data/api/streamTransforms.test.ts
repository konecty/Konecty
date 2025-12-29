import { expect } from 'chai';
import { Readable } from 'node:stream';
import { ApplyDateToStringTransform, ApplyFieldPermissionsTransform } from '../../../src/imports/data/api/streamTransforms';
import { DataDocument } from '@imports/types/data';
import { DateTime } from 'luxon';

describe('StreamTransforms', () => {
	describe('ApplyFieldPermissionsTransform', () => {
		it('should remove fields when condition returns false', done => {
			const accessConditions = {
				field1: (record: DataDocument) => record.field1 === 'allowed',
				field2: (record: DataDocument) => record.field2 !== 'forbidden',
			};

			const transform = new ApplyFieldPermissionsTransform(accessConditions);
			const records: DataDocument[] = [];

			transform.on('data', (record: DataDocument) => {
				records.push(record);
			});

			transform.on('end', () => {
				expect(records).to.have.length(2);
				expect(records[0]).to.not.have.property('field1');
				expect(records[0]).to.have.property('field2');
				expect(records[1]).to.have.property('field1');
				expect(records[1]).to.not.have.property('field2');
				done();
			});

			transform.on('error', done);

			transform.write({ _id: '1', field1: 'not-allowed', field2: 'allowed' });
			transform.write({ _id: '2', field1: 'allowed', field2: 'forbidden' });
			transform.end();
		});

		it('should keep fields when condition returns true', done => {
			const accessConditions = {
				field1: () => true,
				field2: () => true,
			};

			const transform = new ApplyFieldPermissionsTransform(accessConditions);
			const records: DataDocument[] = [];

			transform.on('data', (record: DataDocument) => {
				records.push(record);
			});

			transform.on('end', () => {
				expect(records).to.have.length(1);
				expect(records[0]).to.have.property('field1', 'value1');
				expect(records[0]).to.have.property('field2', 'value2');
				done();
			});

			transform.on('error', done);

			transform.write({ _id: '1', field1: 'value1', field2: 'value2' });
			transform.end();
		});

		it('should process records one by one without accumulating', done => {
			const accessConditions = {
				field1: () => true,
			};

			const transform = new ApplyFieldPermissionsTransform(accessConditions);
			let recordCount = 0;

			transform.on('data', () => {
				recordCount++;
			});

			transform.on('end', () => {
				expect(recordCount).to.equal(3);
				done();
			});

			transform.on('error', done);

			transform.write({ _id: '1', field1: 'value1' });
			transform.write({ _id: '2', field1: 'value2' });
			transform.write({ _id: '3', field1: 'value3' });
			transform.end();
		});

		it('should handle errors in conditions gracefully', done => {
			const accessConditions = {
				field1: () => {
					throw new Error('Condition error');
				},
			};

			const transform = new ApplyFieldPermissionsTransform(accessConditions);

			transform.on('error', error => {
				expect(error).to.be.instanceOf(Error);
				expect(error.message).to.equal('Condition error');
				done();
			});

			transform.write({ _id: '1', field1: 'value1' });
		});
	});

	describe('ApplyDateToStringTransform', () => {
		it('should convert dates to string correctly', done => {
			const transform = new ApplyDateToStringTransform();
			const records: DataDocument[] = [];

			transform.on('data', (record: DataDocument) => {
				records.push(record);
			});

			transform.on('end', () => {
				expect(records).to.have.length(1);
				// dateToString converts Date objects to ISO strings
				expect(records[0].dateField).to.be.a('string');
				expect(records[0].otherField).to.equal('unchanged');
				done();
			});

			transform.on('error', done);

			const date = new Date();
			transform.write({ _id: '1', dateField: date, otherField: 'unchanged' });
			transform.end();
		});

		it('should keep other fields unchanged', done => {
			const transform = new ApplyDateToStringTransform();
			const records: DataDocument[] = [];

			transform.on('data', (record: DataDocument) => {
				records.push(record);
			});

			transform.on('end', () => {
				expect(records).to.have.length(1);
				expect(records[0].stringField).to.equal('test');
				expect(records[0].numberField).to.equal(123);
				expect(records[0].booleanField).to.equal(true);
				done();
			});

			transform.on('error', done);

			transform.write({
				_id: '1',
				stringField: 'test',
				numberField: 123,
				booleanField: true,
			});
			transform.end();
		});

		it('should process records one by one', done => {
			const transform = new ApplyDateToStringTransform();
			let recordCount = 0;

			transform.on('data', () => {
				recordCount++;
			});

			transform.on('end', () => {
				expect(recordCount).to.equal(3);
				done();
			});

			transform.on('error', done);

			transform.write({ _id: '1', field: 'value1' });
			transform.write({ _id: '2', field: 'value2' });
			transform.write({ _id: '3', field: 'value3' });
			transform.end();
		});
	});
});

