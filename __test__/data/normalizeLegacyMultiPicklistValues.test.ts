import { normalizeLegacyMultiPicklistValues } from '../../src/imports/data/normalizeLegacyMultiPicklistValues';
import type { Document } from '../../src/imports/model/Document';
import type { DataDocument } from '../../src/imports/types/data';

describe('normalizeLegacyMultiPicklistValues', () => {
	it('wraps legacy string picklist value when maxSelected > 1', () => {
		const meta = {
			type: 'document' as const,
			_id: 'Campaign',
			name: 'Campaign',
			label: { en: 'Campaign', pt_BR: 'Campanha' },
			plurals: { en: 'Campaigns', pt_BR: 'Campanhas' },
			icon: 'bullhorn',
			fields: {
				crms: {
					name: 'crms',
					type: 'picklist',
					maxSelected: 3,
					options: { vista: { en: 'Vista', pt_BR: 'Vista' } },
				},
			},
		} as unknown as Document;

		const record = { _id: 'x', crms: 'vista' } as unknown as DataDocument;
		const out = normalizeLegacyMultiPicklistValues(meta, record);
		expect(out.crms).toEqual(['vista']);
	});

	it('leaves array values unchanged', () => {
		const meta = {
			type: 'document' as const,
			_id: 'Campaign',
			name: 'Campaign',
			label: { en: 'Campaign', pt_BR: 'Campanha' },
			plurals: { en: 'Campaigns', pt_BR: 'Campanhas' },
			icon: 'bullhorn',
			fields: {
				crms: {
					name: 'crms',
					type: 'picklist',
					maxSelected: 3,
					options: { vista: { en: 'Vista', pt_BR: 'Vista' }, bitrix: { en: 'Bitrix', pt_BR: 'Bitrix' } },
				},
			},
		} as unknown as Document;

		const record = { _id: 'x', crms: ['vista', 'bitrix'] } as unknown as DataDocument;
		const out = normalizeLegacyMultiPicklistValues(meta, record);
		expect(out.crms).toEqual(['vista', 'bitrix']);
	});

	it('does not wrap single-select picklist (maxSelected 1)', () => {
		const meta = {
			type: 'document' as const,
			_id: 'Campaign',
			name: 'Campaign',
			label: { en: 'Campaign', pt_BR: 'Campanha' },
			plurals: { en: 'Campaigns', pt_BR: 'Campanhas' },
			icon: 'bullhorn',
			fields: {
				routingType: {
					name: 'routingType',
					type: 'picklist',
					maxSelected: 1,
					options: { queue: { en: 'Queue', pt_BR: 'Roleta' } },
				},
			},
		} as unknown as Document;

		const record = { _id: 'x', routingType: 'queue' } as unknown as DataDocument;
		const out = normalizeLegacyMultiPicklistValues(meta, record);
		expect(out.routingType).toBe('queue');
	});
});
