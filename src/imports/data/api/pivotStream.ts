import { ChildProcess } from 'child_process';
import { Readable } from 'node:stream';
import { logger } from '@imports/utils/logger';
import findStream from './findStream';
import { createPythonProcess, sendRPCRequest, collectResultFromPython } from './pythonStreamBridge';
import { enrichPivotConfig } from './pivotMetadata';
import { PivotStreamParams, PivotEnrichedResult, PivotConfig } from '@imports/types/pivot';
import { KonectyResultError } from '@imports/types/result';
import { errorReturn } from '@imports/utils/return';
import { MetaObject } from '@imports/model/MetaObject';
import { NEWLINE_SEPARATOR } from './streamConstants';

/**
 * Extract all fields needed from pivot config for MongoDB projection
 * Expands lookup fields to include _id, descriptionFields, and searchableFields
 * Following the legacy pattern for complete lookup field expansion
 */
function extractFieldsFromPivotConfig(document: string, pivotConfig: PivotConfig): string[] {
	const meta = MetaObject.Meta[document];
	if (meta == null) {
		const fields = new Set<string>();
		pivotConfig.rows.forEach(row => fields.add(row.field));
		pivotConfig.columns?.forEach(col => fields.add(col.field));
		pivotConfig.values.forEach(val => fields.add(val.field));
		return Array.from(fields);
	}

	const fields = new Set<string>();

	const expandField = (fieldPath: string) => {
		const parts = fieldPath.split('.');
		const baseFieldName = parts[0];
		const field = meta.fields[baseFieldName];

		if (field == null) {
			fields.add(fieldPath);
			return;
		}

		if (field.type === 'lookup' || field.type === 'inheritLookup') {
			// For lookups, we only need _id - we'll populate the rest later
			fields.add(`${baseFieldName}._id`);
		} else if (field.type === 'address') {
			const addressFields = ['city', 'state', 'country', 'district', 'place', 'number', 'postalCode', 'complement', 'placeType'];
			addressFields.forEach(af => {
				fields.add(`${fieldPath}.${af}`);
			});
		} else if (field.type === 'money') {
			fields.add(`${fieldPath}.value`);
			fields.add(`${fieldPath}.currency`);
		} else if (field.type === 'personName') {
			fields.add(`${fieldPath}.full`);
			fields.add(`${fieldPath}.first`);
			fields.add(`${fieldPath}.last`);
		} else if (field.type === 'phone') {
			fields.add(`${fieldPath}.phoneNumber`);
			fields.add(`${fieldPath}.countryCode`);
		} else if (field.type === 'email') {
			fields.add(`${fieldPath}.address`);
		} else {
			fields.add(fieldPath);
		}
	};

	pivotConfig.rows.forEach(row => expandField(row.field));
	pivotConfig.columns?.forEach(col => expandField(col.field));
	pivotConfig.values.forEach(val => expandField(val.field));

	return Array.from(fields);
}

/**
 * Identify lookup fields in the pivot config
 */
function getLookupFieldsInfo(document: string, pivotConfig: PivotConfig): Array<{
	fieldName: string;
	lookupDocument: string;
	descriptionFields: string[];
}> {
	const meta = MetaObject.Meta[document];
	if (meta == null) return [];

	const lookupFields: Array<{ fieldName: string; lookupDocument: string; descriptionFields: string[] }> = [];

	const processField = (fieldPath: string) => {
		const parts = fieldPath.split('.');
		const baseFieldName = parts[0];
		const field = meta.fields[baseFieldName];

		if (field != null && (field.type === 'lookup' || field.type === 'inheritLookup') && field.document) {
			const descFields = field.descriptionFields || ['name'];
			const searchFields = (field as any).searchableFields || [];
			lookupFields.push({
				fieldName: baseFieldName,
				lookupDocument: field.document,
				descriptionFields: [...new Set([...descFields, ...searchFields])],
			});
		}
	};

	pivotConfig.rows.forEach(row => processField(row.field));
	pivotConfig.columns?.forEach(col => processField(col.field));

	return lookupFields;
}

/**
 * Collect all data from stream and populate lookup fields
 */
async function collectAndPopulateData(
	mongoStream: Readable,
	lookupFields: Array<{ fieldName: string; lookupDocument: string; descriptionFields: string[] }>,
): Promise<Record<string, unknown>[]> {
	// 1. Collect all data from stream
	const documents: Record<string, unknown>[] = [];

	await new Promise<void>((resolve, reject) => {
		let buffer = '';

		mongoStream.on('data', (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split(NEWLINE_SEPARATOR);
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (line.trim()) {
					try {
						documents.push(JSON.parse(line));
					} catch (e) {
						logger.warn({ line }, 'Failed to parse JSON line');
					}
				}
			}
		});

		mongoStream.on('end', () => {
			if (buffer.trim()) {
				try {
					documents.push(JSON.parse(buffer));
				} catch (e) {
					logger.warn({ buffer }, 'Failed to parse final buffer');
				}
			}
			resolve();
		});

		mongoStream.on('error', reject);
	});

	if (documents.length === 0 || lookupFields.length === 0) {
		return documents;
	}

	// 2. Collect unique IDs for each lookup field
	const lookupIds: Map<string, Set<string>> = new Map();

	for (const lookupField of lookupFields) {
		const ids = new Set<string>();
		for (const doc of documents) {
			const fieldValue = doc[lookupField.fieldName] as { _id?: string } | { _id?: string }[] | undefined;
			if (fieldValue) {
				if (Array.isArray(fieldValue)) {
					fieldValue.forEach(v => v?._id && ids.add(v._id));
				} else if (fieldValue._id) {
					ids.add(fieldValue._id);
				}
			}
		}
		if (ids.size > 0) {
			lookupIds.set(lookupField.fieldName, ids);
		}
	}

	// 3. Batch fetch lookup data
	const lookupData: Map<string, Map<string, Record<string, unknown>>> = new Map();

	for (const lookupField of lookupFields) {
		const ids = lookupIds.get(lookupField.fieldName);
		if (!ids || ids.size === 0) continue;

		const collection = MetaObject.Collections[lookupField.lookupDocument];
		if (!collection) {
			logger.warn({ document: lookupField.lookupDocument }, 'Collection not found for lookup');
			continue;
		}

		// Build projection from description fields
		const projection: Record<string, 1> = { _id: 1 };
		for (const df of lookupField.descriptionFields) {
			projection[df.split('.')[0]] = 1; // Handle nested fields like "name.full"
		}

		try {
			const lookupDocs = await collection.find(
				{ _id: { $in: Array.from(ids) } },
				{ projection },
			).toArray();

			const dataMap = new Map<string, Record<string, unknown>>();
			for (const doc of lookupDocs) {
				dataMap.set(String(doc._id), doc as Record<string, unknown>);
			}
			lookupData.set(lookupField.fieldName, dataMap);

			logger.info(`Populated ${dataMap.size} records for lookup field ${lookupField.fieldName}`);
		} catch (err) {
			logger.error(err, `Error fetching lookup data for ${lookupField.fieldName}`);
		}
	}

	// 4. Enrich documents with lookup data
	for (const doc of documents) {
		for (const lookupField of lookupFields) {
			const dataMap = lookupData.get(lookupField.fieldName);
			if (!dataMap) continue;

			const fieldValue = doc[lookupField.fieldName] as { _id?: string } | { _id?: string }[] | undefined;
			if (!fieldValue) continue;

			if (Array.isArray(fieldValue)) {
				doc[lookupField.fieldName] = fieldValue.map(v => {
					if (v?._id) {
						const lookupDoc = dataMap.get(v._id);
						return lookupDoc ?? v;
					}
					return v;
				});
			} else if (fieldValue._id) {
				const lookupDoc = dataMap.get(fieldValue._id);
				if (lookupDoc) {
					doc[lookupField.fieldName] = lookupDoc;
				}
			}
		}
	}

	return documents;
}

/**
 * Send collected data to Python process
 */
async function sendDataToPython(pythonProcess: ChildProcess, documents: Record<string, unknown>[]): Promise<void> {
	return new Promise((resolve, reject) => {
		if (pythonProcess.stdin == null) {
			reject(new Error('Python process stdin is not available'));
			return;
		}

		for (const doc of documents) {
			pythonProcess.stdin.write(JSON.stringify(doc) + NEWLINE_SEPARATOR);
		}

		pythonProcess.stdin.end();
		resolve();
	});
}

export default async function pivotStream({
	pivotConfig,
	transformDatesToString = true,
	tracingSpan,
	lang = 'pt_BR',
	...findParams
}: PivotStreamParams): Promise<PivotEnrichedResult | KonectyResultError> {
	let pythonProcess: ChildProcess | null = null;

	try {
		tracingSpan?.addEvent('Starting pivot stream processing');

		// 0. Enrich pivot config with metadata
		tracingSpan?.addEvent('Enriching pivot config with metadata');
		const enrichedConfig = enrichPivotConfig(findParams.document, pivotConfig, lang);

		// 0.1 Extract fields from pivot config for proper projection
		const pivotFields = extractFieldsFromPivotConfig(findParams.document, pivotConfig);
		tracingSpan?.addEvent('Extracted pivot fields', { fields: pivotFields.join(',') });
		logger.info(`Pivot fields extracted: ${pivotFields.join(', ')}`);

		// 0.2 Identify lookup fields that need population
		const lookupFields = getLookupFieldsInfo(findParams.document, pivotConfig);
		logger.info(`Lookup fields to populate: ${lookupFields.map(l => `${l.fieldName} -> ${l.lookupDocument}`).join(', ')}`);

		// Merge with existing fields if any
		const existingFields = findParams.fields ? findParams.fields.split(',').map(f => f.trim()) : [];
		const allFields = [...new Set([...existingFields, ...pivotFields])];
		logger.info(`All fields for MongoDB projection: ${allFields.join(', ')}`);

		// 1. Call findStream to get MongoDB data stream
		// Use a configurable limit to prevent memory issues
		// Default to 100,000 records which should be reasonable for most pivot tables
		const PIVOT_MAX_RECORDS = parseInt(process.env.PIVOT_MAX_RECORDS ?? '100000', 10);
		tracingSpan?.addEvent('Calling findStream to get data');

		// Log filter for debugging
		logger.info(`Pivot query filter: ${JSON.stringify(findParams.filter)}`);
		logger.info(`Pivot query limit: ${PIVOT_MAX_RECORDS}`);
		const streamResult = await findStream({
			...findParams,
			fields: allFields.join(','),
			limit: PIVOT_MAX_RECORDS,
			getTotal: true, // Get total count to know if limit was reached
			transformDatesToString,
			tracingSpan,
		});

		if (streamResult.success === false) {
			return streamResult;
		}

		const { data: mongoStream, total } = streamResult;

		// Log total from findStream (after filters, before limit)
		logger.info(`Total records from findStream (after filters, before limit): ${total ?? 'unknown'}`);

		// 2. Collect data and populate lookups
		tracingSpan?.addEvent('Collecting and populating lookup data');
		logger.info('Starting to collect data from MongoDB stream...');
		const startCollect = Date.now();
		const populatedData = await collectAndPopulateData(mongoStream, lookupFields);
		const collectTime = Date.now() - startCollect;
		logger.info(`Collected ${populatedData.length} documents with populated lookups in ${collectTime}ms`);
		logger.info(`Total records available (from findStream): ${total ?? 'unknown'}`);
		// Check if limit was reached using total count from find
		const totalRecords = total ?? populatedData.length;
		const limitReached = totalRecords > PIVOT_MAX_RECORDS;
		if (limitReached) {
			logger.warn(`Pivot result limited to ${PIVOT_MAX_RECORDS} of ${totalRecords} records. Results may be incomplete.`);
		}

		if (populatedData.length === 0) {
			return {
				success: true,
				metadata: {
					rows: enrichedConfig.rows,
					columns: enrichedConfig.columns,
					values: enrichedConfig.values,
				},
				data: [],
				grandTotals: { cells: {}, totals: {} },
				total: 0,
			};
		}

		// 3. Create Python process
		tracingSpan?.addEvent('Creating Python process');
		pythonProcess = createPythonProcess();

		// 4. Send RPC request with enriched pivot config
		// Include blankText translated based on language
		const blankText = lang === 'pt_BR' ? '(vazio)' : '(blank)';
		tracingSpan?.addEvent('Sending RPC request to Python');
		await sendRPCRequest(pythonProcess, 'pivot', { config: enrichedConfig, blankText } as any);

		// 5. Send populated data to Python
		tracingSpan?.addEvent('Sending data to Python');
		logger.info(`Sending ${populatedData.length} documents to Python for aggregation...`);
		const startPython = Date.now();
		await sendDataToPython(pythonProcess, populatedData);

		// 6. Collect result from Python
		tracingSpan?.addEvent('Collecting result from Python');
		const { data: hierarchyData, grandTotals, columnHeaders } = await collectResultFromPython(pythonProcess);
		const pythonTime = Date.now() - startPython;
		logger.info(`Python aggregation completed in ${pythonTime}ms, columnHeaders: ${columnHeaders?.length ?? 0}`);

		// 7. Return enriched result
		tracingSpan?.addEvent('Pivot processing completed', {
			rowCount: String(hierarchyData.length),
			columnCount: String(columnHeaders?.length ?? 0),
		});

		const result: PivotEnrichedResult = {
			success: true,
			metadata: {
				rows: enrichedConfig.rows,
				columns: enrichedConfig.columns,
				values: enrichedConfig.values,
			},
			data: hierarchyData as PivotEnrichedResult['data'],
			grandTotals: grandTotals as unknown as PivotEnrichedResult['grandTotals'],
			columnHeaders: columnHeaders as PivotEnrichedResult['columnHeaders'],
		};

		if (total != null) {
			result.total = total;
		}
		// Add limit info if limit was reached
		if (limitReached) {
			(result as any).limitInfo = {
				limited: true,
				limit: PIVOT_MAX_RECORDS,
				total: totalRecords,
			};
		}

		return result;
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);
		logger.error(error, `Error executing pivotStream: ${error.message}`);

		if (pythonProcess != null && !pythonProcess.killed) {
			try {
				pythonProcess.kill();
			} catch (killError) {
				logger.warn(killError, 'Error killing Python process during cleanup');
			}
		}

		return errorReturn('Oops something went wrong, please try again later... if this message persisits, please contact our support');
	}
}
