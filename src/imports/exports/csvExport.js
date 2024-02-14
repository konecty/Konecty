
/**
 * 
 * @param {string[]} headers 
 * @param {object[]} data 
 * @param {string} name 
 * @returns {Promise<{ httpHeaders: object, content: string }>}
 */
export function csvExport(headers, data, name) {
    // Define separator, sufix and prefix
    const separator = '","';
    const prefix = '"';
    const sufix = '"';

    // Send headers with content type and file name
    const httpHeaders = {
        'Content-Type': 'application/csv',
        'Content-Disposition': `attachment; filename=${name}.csv`,
    };

    // Iterate over keys to send header line
    let header = headers.join(separator);

    if (header !== '') {
        header = prefix + header + sufix;
    }

    const content = [header];

    // Iterate over data
    for (let item of data) {
        let value = [];
        // And iterate over keys to get value or empty
        for (let key of headers) {
            const v = item[key];
            // If no value then send empty string
            value.push(v || '');
        }

        value = value.join(separator);

        if (value !== '') {
            value = prefix + value + sufix;
        }

        // Send each line
        content.push(value);
    }

    return { httpHeaders, content: content.join('\n') };
}