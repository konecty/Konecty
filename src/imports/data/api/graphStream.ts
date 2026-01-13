import { ChildProcess } from 'child_process';
import { Readable } from 'node:stream';
import { logger } from '@imports/utils/logger';
import findStream from './findStream';
import { createGraphPythonProcess, sendGraphRPCRequest, collectSVGFromPython } from './pythonStreamBridge';
import { GraphStreamParams, GraphStreamResult, GraphConfig } from '@imports/types/graph';
import { KonectyResultError, KonectyError } from '@imports/types/result';
import { errorReturn } from '@imports/utils/return';
import { MetaObject } from '@imports/model/MetaObject';
import { getGraphErrorMessage } from '@imports/utils/graphErrors';
import { NEWLINE_SEPARATOR } from './streamConstants';
import { enrichGraphConfig } from './graphMetadata';

/**
 * Graph Stream Processing
 * Processa requisições de gráficos: extrai campos, popula lookups, envia para Python
 * 
 * ADR-0016: Processamento no backend (agregação e geração de SVG no Python)
 * ADR-0008: Mensagens de erro traduzidas (backend retorna em inglês, frontend traduz)
 */

/**
 * Extract all fields needed from graph config for MongoDB projection
 * Expands lookup fields, address, money, personName, phone, email fields
 * Following the same pattern as extractFieldsFromPivotConfig
 */
function extractFieldsFromGraphConfig(document: string, graphConfig: GraphConfig): string[] {
	const meta = MetaObject.Meta[document];
	const fields = new Set<string>();

	const expandField = (fieldPath: string) => {
		if (!fieldPath) return;

		const parts = fieldPath.split('.');
		const baseFieldName = parts[0];

		// For system fields starting with _, check if they are lookups in meta
		// System lookup fields like _user, _createdBy, _updatedBy need special handling
		if (baseFieldName.startsWith('_')) {
			// Check if this system field is a lookup in the meta
			if (meta != null) {
				const field = meta.fields[baseFieldName];
				if (field != null && (field.type === 'lookup' || field.type === 'inheritLookup')) {
					// System lookup field - include _id for population
					fields.add(`${baseFieldName}._id`);
					return;
				}
			}
			// Not a lookup or no meta - include directly
			fields.add(fieldPath);
			return;
		}

		if (meta == null) {
			fields.add(fieldPath);
			return;
		}

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

	// Extract fields from xAxis, yAxis, categoryField, and series
	if (graphConfig.xAxis?.field) {
		expandField(graphConfig.xAxis.field);
	}
	if (graphConfig.yAxis?.field) {
		expandField(graphConfig.yAxis.field);
	}
	if (graphConfig.categoryField) {
		expandField(graphConfig.categoryField);
		// For categoryField with bucket, ensure the base field is included (bucket is applied in Python)
		// System fields starting with _ are already handled by expandField, but ensure it's explicitly added
		fields.add(graphConfig.categoryField);
	}
	// Extract fields from series
	if (graphConfig.series) {
		graphConfig.series.forEach(serie => {
			if (serie.field) {
				expandField(serie.field);
			}
		});
	}

	// Always include system fields that are referenced in the config (especially for buckets)
	// This ensures _createdAt, _updatedAt, etc. are available even if projection filters them
	// NOTE: System fields that are lookups are handled by expandField above (they get _id suffix)
	// Here we only add non-lookup system fields (like _createdAt, _updatedAt, _id)
	const systemFieldsToCheck = [graphConfig.categoryField, graphConfig.xAxis?.field, graphConfig.yAxis?.field];
	if (graphConfig.series) {
		graphConfig.series.forEach(serie => {
			if (serie.field) systemFieldsToCheck.push(serie.field);
		});
	}
	
	systemFieldsToCheck.forEach(field => {
		if (field && field.startsWith('_')) {
			// Check if this is a lookup field - if so, it was already handled by expandField
			if (meta != null) {
				const metaField = meta.fields[field];
				if (metaField != null && (metaField.type === 'lookup' || metaField.type === 'inheritLookup')) {
					// Already handled by expandField with _id suffix
					return;
				}
			}
			// Non-lookup system field - include directly
			fields.add(field);
		}
	});

	return Array.from(fields);
}

/**
 * Identify lookup fields in the graph config
 */
function getLookupFieldsInfo(document: string, graphConfig: GraphConfig): Array<{
	fieldName: string;
	lookupDocument: string;
	descriptionFields: string[];
}> {
	const meta = MetaObject.Meta[document];
	if (meta == null) return [];

	const lookupFields: Array<{ fieldName: string; lookupDocument: string; descriptionFields: string[] }> = [];

	const processField = (fieldPath: string) => {
		if (!fieldPath) return;

		const parts = fieldPath.split('.');
		const baseFieldName = parts[0];
		const field = meta.fields[baseFieldName];

		// Debug: log field info for troubleshooting
		if (baseFieldName.startsWith('_')) {
			logger.info(`Processing field ${baseFieldName}: exists=${field != null}, type=${field?.type ?? 'undefined'}`);
		}

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

	// Process xAxis, yAxis, categoryField, and series
	if (graphConfig.xAxis?.field) {
		processField(graphConfig.xAxis.field);
	}
	if (graphConfig.yAxis?.field) {
		processField(graphConfig.yAxis.field);
	}
	if (graphConfig.categoryField) {
		processField(graphConfig.categoryField);
	}
	// Process series fields
	if (graphConfig.series) {
		graphConfig.series.forEach(serie => {
			if (serie.field) {
				processField(serie.field);
			}
		});
	}

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

export default async function graphStream({
	graphConfig,
	transformDatesToString = true,
	tracingSpan,
	...findParams
}: GraphStreamParams): Promise<GraphStreamResult | KonectyResultError> {
	let pythonProcess: ChildProcess | null = null;

	try {
		tracingSpan?.addEvent('Starting graph stream processing');

		// 1. Validate graphConfig
		if (graphConfig == null) {
			tracingSpan?.end();
			const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_MISSING');
			return errorReturn([{ message: errorMsg.message, code: errorMsg.code } as KonectyError]);
		}

		if (!graphConfig.type) {
			tracingSpan?.end();
			const errorMsg = getGraphErrorMessage('GRAPH_CONFIG_TYPE_MISSING');
			return errorReturn([{ message: errorMsg.message, code: errorMsg.code } as KonectyError]);
		}

		// 0. Enrich graph config with metadata (labels translated)
		tracingSpan?.addEvent('Enriching graph config with metadata');
		logger.info(`Original graphConfig: ${JSON.stringify(graphConfig)}`);
		const enrichedConfig = enrichGraphConfig(findParams.document, graphConfig, findParams.lang || 'pt_BR');
		logger.info(`Enriched graphConfig: ${JSON.stringify(enrichedConfig)}`);
		logger.info(`Using lang: ${findParams.lang || 'pt_BR'}`);

		// 1.1 Extract fields from graph config for proper projection
		const graphFields = extractFieldsFromGraphConfig(findParams.document, enrichedConfig);
		tracingSpan?.addEvent('Extracted graph fields', { fields: graphFields.join(',') });
		logger.info(`Graph fields extracted: ${graphFields.join(', ')}`);

		// 1.2 Identify lookup fields that need population
		const lookupFields = getLookupFieldsInfo(findParams.document, enrichedConfig);
		logger.info(`Lookup fields to populate: ${lookupFields.map(l => `${l.fieldName} -> ${l.lookupDocument} (${l.descriptionFields.join(',')})`).join(', ')}`);
		
		// Debug: Check if xAxis.field is a lookup that was identified
		if (enrichedConfig.xAxis?.field) {
			const xAxisField = enrichedConfig.xAxis.field;
			const isXAxisLookup = lookupFields.some(l => l.fieldName === xAxisField);
			logger.info(`xAxis.field=${xAxisField}, isLookup=${isXAxisLookup}`);
		}

		// Merge with existing fields if any
		const existingFields = findParams.fields ? findParams.fields.split(',').map(f => f.trim()) : [];
		const allFields = [...new Set([...existingFields, ...graphFields])];
		logger.info(`All fields for MongoDB projection: ${allFields.join(', ')}`);

		// 2. Call findStream to get MongoDB data stream
		// Use a configurable limit to prevent memory issues
		// Default to 100,000 records which should be reasonable for most graphs
		const GRAPH_MAX_RECORDS = parseInt(process.env.GRAPH_MAX_RECORDS ?? '100000', 10);
		tracingSpan?.addEvent('Calling findStream to get data');
		
		// Log filter and limit for debugging
		logger.info(`Graph query filter: ${JSON.stringify(findParams.filter)}`);
		logger.info(`Graph query limit: ${GRAPH_MAX_RECORDS}`);
		
		const streamResult = await findStream({
			...findParams,
			fields: allFields.length > 0 ? allFields.join(',') : findParams.fields,
			limit: GRAPH_MAX_RECORDS,
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

		// 3. Collect data and populate lookups
		tracingSpan?.addEvent('Collecting and populating lookup data');
		logger.info('Starting to collect data from MongoDB stream...');
		const startCollect = Date.now();
		const populatedData = await collectAndPopulateData(mongoStream, lookupFields);
		const collectTime = Date.now() - startCollect;
		logger.info(`Collected ${populatedData.length} documents with populated lookups in ${collectTime}ms`);
		logger.info(`Total records available (from findStream): ${total ?? 'unknown'}`);
		
		// Log sample document keys for debugging field availability
		if (populatedData.length > 0) {
			const sampleDoc = populatedData[0];
			const flatKeys = Object.keys(sampleDoc);
			logger.info(`Sample document keys: ${flatKeys.join(', ')}`);
		}
		
		// Check if limit was reached using total count from find
		const totalRecords = total ?? populatedData.length;
		const limitReached = totalRecords > GRAPH_MAX_RECORDS;
		if (limitReached) {
			logger.warn(`Graph result limited to ${GRAPH_MAX_RECORDS} of ${totalRecords} records. Results may be incomplete.`);
		}

		if (populatedData.length === 0) {
			// Return empty result
			return {
				success: true,
				svg: '<svg></svg>',
				total: 0,
			};
		}

		// 4. Create Python process with uv run
		tracingSpan?.addEvent('Creating Python process');
		pythonProcess = createGraphPythonProcess();

		// 5. Send RPC request with enriched graph config to Python stdin (first line)
		tracingSpan?.addEvent('Sending RPC request to Python');
		logger.info(`Sending enriched graph config to Python: ${JSON.stringify(enrichedConfig)}`);
		await sendGraphRPCRequest(pythonProcess, 'graph', { config: enrichedConfig, lang: findParams.lang || 'pt_BR' });

		// 6. Send populated data to Python
		tracingSpan?.addEvent('Sending populated data to Python');
		logger.info(`Sending ${populatedData.length} documents to Python for graph generation...`);
		const startPython = Date.now();
		await sendDataToPython(pythonProcess, populatedData);

		// 7. Read RPC response from Python stdout (first line) and collect SVG content
		tracingSpan?.addEvent('Collecting SVG from Python');
		const svg = await collectSVGFromPython(pythonProcess);
		const pythonTime = Date.now() - startPython;
		logger.info(`Python graph generation completed in ${pythonTime}ms`);

		// 7. Return SVG string
		tracingSpan?.addEvent('Graph processing completed', {
			svgLength: String(svg.length),
		});

		const result: GraphStreamResult = {
			success: true,
			svg,
		};

		if (total != null) {
			result.total = total;
		}

		return result;
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);
		logger.error(error, `Error executing graphStream: ${error.message}`, {
			stack: error.stack,
			document: findParams.document
		});

		// Cleanup: kill Python process if it's still running
		if (pythonProcess != null && !pythonProcess.killed) {
			try {
				pythonProcess.kill();
			} catch (killError) {
				logger.warn(killError, 'Error killing Python process during cleanup');
			}
		}

		const errorMsg = getGraphErrorMessage('GRAPH_PROCESSING_ERROR', {
			details: error.message
		});
		return errorReturn([{ message: errorMsg.message, code: errorMsg.code, details: errorMsg.details } as KonectyError]);
	}
}

