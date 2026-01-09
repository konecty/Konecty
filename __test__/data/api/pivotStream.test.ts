import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { ChildProcess } from 'child_process';
import { PivotConfig } from '@imports/types/pivot';
import { KonectyResultError } from '@imports/types/result';

// Mock modules with factory functions
const mockFindStream = jest.fn();
const mockCreatePythonProcess = jest.fn();
const mockSendRPCRequest = jest.fn();
const mockStreamToPython = jest.fn();
const mockCollectResultFromPython = jest.fn();

jest.mock('../../../src/imports/data/api/findStream', () => ({
	default: mockFindStream,
}));

jest.mock('../../../src/imports/data/api/pythonStreamBridge', () => ({
	createPythonProcess: mockCreatePythonProcess,
	sendRPCRequest: mockSendRPCRequest,
	streamToPython: mockStreamToPython,
	collectResultFromPython: mockCollectResultFromPython,
}));

const mockEnrichPivotConfig = jest.fn();
jest.mock('../../../src/imports/data/api/pivotMetadata', () => ({
	enrichPivotConfig: mockEnrichPivotConfig,
}));

import pivotStream from '../../../src/imports/data/api/pivotStream';

describe('pivotStream', () => {
	const mockPivotConfig: PivotConfig = {
		rows: [{ field: 'status' }],
		columns: [{ field: 'type' }],
		values: [{ field: 'value', aggregator: 'sum' }],
	};

	const mockFindStreamResult = {
		success: true,
		data: new Readable({
			read() {
				this.push('{"_id":"1","status":"Nova","type":"Residencial","value":100000}\n');
				this.push('{"_id":"2","status":"Nova","type":"Comercial","value":200000}\n');
				this.push('{"_id":"3","status":"Em Visitação","type":"Residencial","value":300000}\n');
				this.push(null);
			},
		}),
		total: 3,
	};

	const mockPythonProcess = new EventEmitter() as unknown as ChildProcess;
	(mockPythonProcess as any).stdin = {
		write: (data: string, callback?: (error?: Error | null) => void) => {
			if (callback) callback();
			return true;
		},
		end: () => {},
	};
	(mockPythonProcess as any).stdout = new EventEmitter();
	(mockPythonProcess as any).stderr = new EventEmitter();
	(mockPythonProcess as any).kill = jest.fn();
	(mockPythonProcess as any).killed = false;

	beforeEach(() => {
		jest.clearAllMocks();

		// Default mocks
		mockFindStream.mockResolvedValue(mockFindStreamResult);
		mockCreatePythonProcess.mockReturnValue(mockPythonProcess);
		mockSendRPCRequest.mockResolvedValue(undefined);
		mockStreamToPython.mockResolvedValue(undefined);
		mockCollectResultFromPython.mockResolvedValue({
			data: [],
			grandTotals: { cells: {}, totals: {} },
		});
		
		// Mock enrichPivotConfig to return enriched config
		mockEnrichPivotConfig.mockImplementation((document, config) => ({
			rows: config.rows.map((r: any, i: number) => ({
				field: r.field,
				label: r.field,
				type: 'text',
				level: i,
			})),
			columns: config.columns?.map((c: any) => ({
				field: c.field,
				label: c.field,
				type: 'text',
			})),
			values: config.values.map((v: any) => ({
				field: v.field,
				aggregator: v.aggregator,
				label: v.field,
				type: 'number',
			})),
		}));
	});

	describe('successful pivot processing', () => {
		it('should process pivot table successfully', async () => {
			// Mock hierarchical result structure
			mockCollectResultFromPython.mockResolvedValue({
				data: [
					{
						key: 'Nova',
						label: 'Nova',
						level: 0,
						cells: {
							'Residencial': { value: 100000 },
							'Comercial': { value: 200000 },
						},
						totals: { value: 300000 },
					},
					{
						key: 'Em Visitação',
						label: 'Em Visitação',
						level: 0,
						cells: {
							'Residencial': { value: 300000 },
						},
						totals: { value: 300000 },
					},
				],
				grandTotals: {
					cells: {
						'Residencial': { value: 400000 },
						'Comercial': { value: 200000 },
					},
					totals: { value: 600000 },
				},
				columnHeaders: [
					{
						key: 'Residencial',
						value: 'Residencial',
						label: 'Residencial',
						level: 0,
					},
					{
						key: 'Comercial',
						value: 'Comercial',
						label: 'Comercial',
						level: 0,
					},
				],
			});

			const result = await pivotStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				pivotConfig: mockPivotConfig,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.metadata).toBeDefined();
				expect(result.metadata.rows).toBeDefined();
				expect(result.metadata.values).toBeDefined();
				expect(Array.isArray(result.data)).toBe(true);
				expect(result.data).toHaveLength(2);
				expect(result.grandTotals).toBeDefined();
				expect(result.grandTotals.totals).toBeDefined();
				expect(result.columnHeaders).toBeDefined();
				expect(Array.isArray(result.columnHeaders)).toBe(true);
				if (result.columnHeaders && result.columnHeaders.length > 0) {
					expect(result.columnHeaders[0]).toHaveProperty('key');
					expect(result.columnHeaders[0]).toHaveProperty('value');
					expect(result.columnHeaders[0]).toHaveProperty('label');
					expect(result.columnHeaders[0]).toHaveProperty('level');
				}
				expect(result.total).toBe(3);
			}

			// Verify mocks were called with enriched config
			expect(mockSendRPCRequest).toHaveBeenCalledWith(
				mockPythonProcess,
				'pivot',
				expect.objectContaining({
					config: expect.objectContaining({
						rows: expect.any(Array),
						values: expect.any(Array),
					}),
				}),
			);
			expect(mockStreamToPython).toHaveBeenCalledTimes(1);
			expect(mockCollectResultFromPython).toHaveBeenCalledTimes(1);
		});

		it('should handle pivot without columns', async () => {
			const configWithoutColumns: PivotConfig = {
				rows: [{ field: 'status' }],
				values: [{ field: 'value', aggregator: 'sum' }],
			};

			mockCollectResultFromPython.mockResolvedValue({
				data: [
					{
						key: 'Nova',
						label: 'Nova',
						level: 0,
						cells: { '__default__': { value: 300000 } },
						totals: { value: 300000 },
					},
					{
						key: 'Em Visitação',
						label: 'Em Visitação',
						level: 0,
						cells: { '__default__': { value: 300000 } },
						totals: { value: 300000 },
					},
				],
				grandTotals: {
					cells: { '__default__': { value: 600000 } },
					totals: { value: 600000 },
				},
				columnHeaders: [],
			});

			const result = await pivotStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				pivotConfig: configWithoutColumns,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(Array.isArray(result.data)).toBe(true);
				expect(result.metadata.columns).toBeUndefined();
				expect(result.columnHeaders).toBeDefined();
				expect(Array.isArray(result.columnHeaders)).toBe(true);
			}
		});
	});

	describe('error handling', () => {
		it('should return error when findStream fails', async () => {
			const findStreamError: KonectyResultError = {
				success: false,
				errors: [{ message: 'Find stream error' }],
			};

			mockFindStream.mockResolvedValue(findStreamError);

			const result = await pivotStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				pivotConfig: mockPivotConfig,
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.errors[0]?.message).toBe('Find stream error');
			}
		});

		it('should return error when Python process fails', async () => {
			mockStreamToPython.mockRejectedValue(new Error('Python process error'));

			const result = await pivotStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				pivotConfig: mockPivotConfig,
			});

			expect(result.success).toBe(false);
		});

		it('should return error when collectResultFromPython fails', async () => {
			mockCollectResultFromPython.mockRejectedValue(new Error('Failed to collect result'));

			const result = await pivotStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				pivotConfig: mockPivotConfig,
			});

			expect(result.success).toBe(false);
		});

		it('should cleanup Python process on error', async () => {
			const killSpy = jest.fn();
			const errorProcess = {
				...mockPythonProcess,
				kill: killSpy,
				killed: false,
			} as unknown as ChildProcess;

			mockCreatePythonProcess.mockReturnValue(errorProcess);
			mockStreamToPython.mockRejectedValue(new Error('Stream error'));

			await pivotStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				pivotConfig: mockPivotConfig,
			});

			expect(killSpy).toHaveBeenCalled();
		});
	});

	describe('parameter handling', () => {
		it('should pass transformDatesToString parameter', async () => {
			await pivotStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				pivotConfig: mockPivotConfig,
				transformDatesToString: false,
			});

			expect(mockFindStream).toHaveBeenCalledWith(
				expect.objectContaining({
					transformDatesToString: false,
				}),
			);
		});

		it('should pass tracingSpan parameter', async () => {
			const mockSpan = {
				addEvent: jest.fn(),
				setAttribute: jest.fn(),
				end: jest.fn(),
			};

			await pivotStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				pivotConfig: mockPivotConfig,
				tracingSpan: mockSpan as any,
			});

			expect(mockFindStream).toHaveBeenCalledWith(
				expect.objectContaining({
					tracingSpan: mockSpan,
				}),
			);
			expect(mockSpan.addEvent).toHaveBeenCalled();
		});
	});
});
