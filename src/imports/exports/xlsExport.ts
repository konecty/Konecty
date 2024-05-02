/// <reference path="excel4node.d.ts" />

import { errorReturn, successReturn } from '@imports/utils/return';

import { ExportDataResponse, TransformFlattenData } from '@imports/data/export';
import { KonectyResult } from '@imports/types/result';
import { Workbook, Worksheet } from 'excel4node';
import { Readable } from 'stream';

export default async function xlsExport(dataStream: Readable, name: string): Promise<KonectyResult<ExportDataResponse>> {
	const wb = new Workbook();

	const ws = wb.addWorksheet(name);
	const flattenData = new TransformFlattenData('dd/MM/yyyy HH:mm:ss');

	const widths: Record<string, number> = {};

	return new Promise(async (resolve, reject) => {
		dataStream.on('error', err => {
			reject(errorReturn('Error writing file'));
		});

		await dataStream.pipe(flattenData).reduce(addToWorksheet(flattenData, widths), ws);
		addHeaders(wb, ws, Array.from(flattenData.headers), widths);

		resolve(
			successReturn({
				httpHeaders: {
					'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					'Content-Disposition': `attachment; filename=${name}.xlsx`,
				},
				content: await wb.writeToBuffer(),
			}),
		);
	});
}

function addToWorksheet(flattenData: TransformFlattenData, widths: Record<string, number>) {
	let row = 2;

	return (acc: Worksheet, record: Record<string, unknown>) => {
		const headers = Array.from(flattenData.headers);
		const headerNum = headers.length;

		for (let index = 0; index < headerNum; index++) {
			const header = headers[index];
			let value = record[header] || '';
			const cell = acc.cell(row, index + 1);

			if (typeof value === 'object') {
				value = '';
			}

			const width = String(value).length * 1.1;
			if (widths[header] == null || widths[header] < width) {
				widths[header] = width;
			}

			cell.string(String(value));
		}

		row += 1;
		return acc;
	};
}

const addHeaders = (wb: Workbook, ws: Worksheet, headers: string[], widths: Record<string, number>) => {
	const headerStyle = wb.createStyle({
		font: {
			bold: true,
		},
		fill: {
			type: 'pattern',
			patternType: 'solid',
			fgColor: '#F2F2F2',
		},
	});

	const headerNum = headers.length;

	for (let collumn = 1; collumn <= headerNum; collumn++) {
		const header = headers[collumn - 1];
		const cell = ws.cell(1, collumn);

		cell.string(header).style(headerStyle);
		ws.column(collumn).setWidth(widths[header] ?? 10);
	}
};
