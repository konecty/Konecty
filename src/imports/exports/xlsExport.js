import moment from 'moment';
import isDate from 'lodash/isDate';
import { Workbook } from 'excel4node';
export function xlsExport(headers, data, name, reply) {
    let header, index;
    const wb = new Workbook();
    wb.debug = false;

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

    const ws = wb.addWorksheet(name);

    const widths = {};

    for (index = 0; index < headers.length; index++) {
        header = headers[index];
        ws.cell(1, index + 1)
            .string(header)
            .style(headerStyle);
        widths[index] = String(header).length * 1.1;
    }

    for (let lineIndex = 0; lineIndex < data.length; lineIndex++) {
        const item = data[lineIndex];
        for (index = 0; index < headers.length; index++) {
            header = headers[index];
            let value = item[header] || '';

            if (isDate(value)) {
                value = moment(value).format('DD/MM/YYYY HH:mm:ss');
            }

            const width = String(value).length * 1.1;
            if (widths[index] < width) {
                widths[index] = width;
            }

            //Any objects add on cell it's a critical error for excel4node
            if (typeof value === 'object') {
                value = '';
            }

            ws.cell(lineIndex + 2, index + 1).string('' + value);
        }
    }

    for (index = 0; index < headers.length; index++) {
        header = headers[index];
        ws.column(index + 1).setWidth(widths[index]);
    }

    return wb.write(`${name}.xlsx`, reply);
}