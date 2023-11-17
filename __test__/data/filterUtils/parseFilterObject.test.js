import { expect } from 'chai';
import { parseFilterObject } from '../../../src/imports/data/filterUtils';

describe('FilterUtils > parseFilterObject', () => {
	it('should successfully parse filter object with conditions object', () => {
		const metaObject = {
			_id: 'example',
			fields: {
				status: {
					maxSelected: 1,
					minSelected: 1,
					name: 'status',
					type: 'picklist',
					isSortable: true,
					label: {
						en: 'Status',
						pt_BR: 'Situação',
					},
					optionsSorter: 'asc',
					options: {
						draft: {
							en: 'Draft',
							pt_BR: 'Rascunho',
						},
						active: {
							pt_BR: 'Ativo',
							en: 'Active',
						},
						inactive: {
							en: 'Inactive',
							pt_BR: 'Inativo',
						},
					},
					defaultValue: 'draft',
					renderAs: 'without_scroll',
				},
			},
		};

		const condition = {
			match: 'and',
			filters: [
				{
					match: 'and',
					conditions: {
						'status:in': {
							term: 'status',
							operator: 'in',
							value: ['Ativo'],
							editable: true,
							disabled: false,
							sort: 0,
						},
					},
				},
			],
		};

		const req = {
			user: {
				_id: 'user123',
			},
		};

		const result = parseFilterObject(condition, metaObject, req);

		expect(result).to.be.deep.equal({ status: { $in: ['Ativo'] } });
	});

	it('should successfully parse filter object with conditions array', () => {
		const metaObject = {
			_id: 'example',
			fields: {
				status: {
					maxSelected: 1,
					minSelected: 1,
					name: 'status',
					type: 'picklist',
					isSortable: true,
					label: {
						en: 'Status',
						pt_BR: 'Situação',
					},
					optionsSorter: 'asc',
					options: {
						draft: {
							en: 'Draft',
							pt_BR: 'Rascunho',
						},
						active: {
							pt_BR: 'Ativo',
							en: 'Active',
						},
						inactive: {
							en: 'Inactive',
							pt_BR: 'Inativo',
						},
					},
					defaultValue: 'draft',
					renderAs: 'without_scroll',
				},
			},
		};

		const condition = {
			match: 'and',
			filters: [
				{
					match: 'and',
					conditions: [
						{
							term: 'status',
							operator: 'equals',
							value: 'Em Andamento',
						},
					],
				},
			],
		};

		const req = {
			user: {
				_id: 'user123',
			},
		};

		const result = parseFilterObject(condition, metaObject, req);

		expect(result).to.be.deep.equal({ status: 'Em Andamento' });
	});
});
