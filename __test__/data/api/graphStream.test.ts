import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { ChildProcess } from 'child_process';
import { GraphConfig } from '@imports/types/graph';
import { KonectyResultError } from '@imports/types/result';

// Mock modules with factory functions
const mockFindStream = jest.fn();
const mockCreateGraphPythonProcess = jest.fn();
const mockSendGraphRPCRequest = jest.fn();
const mockStreamToPython = jest.fn();
const mockCollectSVGFromPython = jest.fn();

jest.mock('../../../src/imports/data/api/findStream', () => ({
	default: mockFindStream,
}));

jest.mock('../../../src/imports/data/api/pythonStreamBridge', () => ({
	createGraphPythonProcess: mockCreateGraphPythonProcess,
	sendGraphRPCRequest: mockSendGraphRPCRequest,
	streamToPython: mockStreamToPython,
	collectSVGFromPython: mockCollectSVGFromPython,
}));

import graphStream from '../../../src/imports/data/api/graphStream';

describe('graphStream', () => {
	const mockGraphConfig: GraphConfig = {
		type: 'bar',
		categoryField: 'status',
		aggregation: 'count',
		xAxis: { field: 'status' },
		yAxis: { field: 'code' },
		title: 'Test Chart',
	};

	const mockFindStreamResult = {
		success: true,
		data: new Readable({
			read() {
				this.push('{"_id":"1","status":"Nova","code":1}\n');
				this.push('{"_id":"2","status":"Em Visitação","code":2}\n');
				this.push(null);
			},
		}),
		total: 2,
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
		mockCreateGraphPythonProcess.mockReturnValue(mockPythonProcess);
		mockSendGraphRPCRequest.mockResolvedValue(undefined);
		mockStreamToPython.mockResolvedValue(undefined);
		mockCollectSVGFromPython.mockResolvedValue('<svg>...</svg>');
	});

	describe('successful graph generation', () => {
		it('should generate graph successfully', async () => {
			const result = await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: mockGraphConfig,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.svg).toBe('<svg>...</svg>');
				expect(result.total).toBe(2);
			}

			expect(mockFindStream).toHaveBeenCalledTimes(1);
			expect(mockCreateGraphPythonProcess).toHaveBeenCalledTimes(1);
			expect(mockSendGraphRPCRequest).toHaveBeenCalledWith(
				mockPythonProcess,
				'graph',
				expect.objectContaining({
					config: mockGraphConfig,
				}),
			);
			expect(mockStreamToPython).toHaveBeenCalledTimes(1);
			expect(mockCollectSVGFromPython).toHaveBeenCalledTimes(1);
		});

		it('should handle graph without total', async () => {
			const findStreamResultWithoutTotal = {
				success: true,
				data: mockFindStreamResult.data,
			};

			mockFindStream.mockResolvedValue(findStreamResultWithoutTotal);

			const result = await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: mockGraphConfig,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.total).toBeUndefined();
			}
		});
	});

	describe('error handling', () => {
		it('should return error when graphConfig is null', async () => {
			const result = await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: null as unknown as GraphConfig,
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.errors[0]?.message).toBe('graphConfig is required');
			}
		});

		it('should return error when graphConfig.type is missing', async () => {
			const invalidConfig = { ...mockGraphConfig, type: undefined } as unknown as GraphConfig;

			const result = await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: invalidConfig,
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.errors[0]?.message).toBe('graphConfig.type is required');
			}
		});

		it('should return error when findStream fails', async () => {
			const findStreamError: KonectyResultError = {
				success: false,
				errors: [{ message: 'Find stream error' }],
			};

			mockFindStream.mockResolvedValue(findStreamError);

			const result = await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: mockGraphConfig,
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.errors[0]?.message).toBe('Find stream error');
			}
		});

		it('should return error when Python process fails', async () => {
			mockStreamToPython.mockRejectedValue(new Error('Python process error'));

			const result = await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: mockGraphConfig,
			});

			expect(result.success).toBe(false);
		});

		it('should return error when collectSVGFromPython fails', async () => {
			mockCollectSVGFromPython.mockRejectedValue(new Error('Failed to collect SVG'));

			const result = await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: mockGraphConfig,
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

			mockCreateGraphPythonProcess.mockReturnValue(errorProcess);
			mockStreamToPython.mockRejectedValue(new Error('Stream error'));

			await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: mockGraphConfig,
			});

			expect(killSpy).toHaveBeenCalled();
		});
	});

	describe('parameter handling', () => {
		it('should pass transformDatesToString parameter', async () => {
			await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: mockGraphConfig,
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

			await graphStream({
				document: 'Opportunity',
				authTokenId: 'test-token',
				graphConfig: mockGraphConfig,
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

