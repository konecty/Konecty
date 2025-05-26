import { validateAndProcessValueFor } from '../../../src/imports/meta/validateAndProcessValueFor';

const baseMeta = {
    _id: 'Test',
    name: 'Test',
    fields: {
        pick: {
            type: 'picklist',
            options: { A: 'A', B: 'B', C: 'C', Quadrados: 'Quadrados' },
            isRequired: false,
        },
    },
};

const defaultParams = {
    meta: baseMeta,
    fieldName: 'pick',
    actionType: 'create',
    objectOriginalValues: {},
    objectNewValues: {},
    idsToUpdate: [],
};

describe('Picklist Validation', () => {
    it('should treat empty string as null', async () => {
        const params = {
            ...defaultParams,
            value: '',
        };
        const result = await validateAndProcessValueFor(params);
        expect(result.success).toBe(true);
        expect(result).not.toHaveProperty('data');
    });

    it('should allow single select with minSelected=1, maxSelected=1', async () => {
        const meta = {
            ...baseMeta,
            fields: {
                pick: {
                    ...baseMeta.fields.pick,
                    minSelected: 1,
                    maxSelected: 1,
                },
            },
        };
        // Valid value
        let result = await validateAndProcessValueFor({ ...defaultParams, meta, value: 'A' });
        expect(result.success).toBe(true);
        expect(result.data).toBe('A');

        // Invalid: empty
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: '' });
        expect(result.success).toBe(false);

        // Invalid: array with more than 1
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A', 'B'] });
        expect(result.success).toBe(false);
    });

    it('should allow single select with minSelected=0, maxSelected=1', async () => {
        const meta = {
            ...baseMeta,
            fields: {
                pick: {
                    ...baseMeta.fields.pick,
                    minSelected: 0,
                    maxSelected: 1,
                },
            },
        };
        // Valid: null
        let result = await validateAndProcessValueFor({ ...defaultParams, meta, value: null });
        expect(result.success).toBe(true);

        // Valid: single value
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: 'B' });
        expect(result.success).toBe(true);

        // Valid: single value
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: 'Quadrados' });
        expect(result.success).toBe(true);

        // Invalid: array with more than 1
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A', 'B'] });
        expect(result.success).toBe(false);
    });

    it('should allow multi-select with minSelected=2, maxSelected=3', async () => {
        const meta = {
            ...baseMeta,
            fields: {
                pick: {
                    ...baseMeta.fields.pick,
                    minSelected: 2,
                    maxSelected: 3,
                },
            },
        };
        // Valid: 2 items
        let result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A', 'B'] });
        expect(result.success).toBe(true);

        // Valid: 3 items
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A', 'B', 'C'] });
        expect(result.success).toBe(true);

        // Invalid: 1 item
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A'] });
        expect(result.success).toBe(false);

        // Invalid: 4 items
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A', 'B', 'C', 'A'] });
        expect(result.success).toBe(false);
    });

    it('should fail if value is not in options', async () => {
        const meta = {
            ...baseMeta,
            fields: {
                pick: {
                    ...baseMeta.fields.pick,
                    minSelected: 1,
                    maxSelected: 2,
                },
            },
        };
        let result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A', 'Z'] });
        expect(result.success).toBe(false);
        expect(result.errors[0].message).toMatch(/invalid/);
    });

    it('should allow no selection if minSelected=0, maxSelected=0', async () => {
        const meta = {
            ...baseMeta,
            fields: {
                pick: {
                    ...baseMeta.fields.pick,
                    minSelected: 0,
                    maxSelected: 0,
                },
            },
        };
        let result = await validateAndProcessValueFor({ ...defaultParams, meta, value: [] });
        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
    });

    it('should allow at least 1 and at most 3 selections', async () => {
        const meta = {
            ...baseMeta,
            fields: {
                pick: {
                    ...baseMeta.fields.pick,
                    minSelected: 1,
                    maxSelected: 3,
                },
            },
        };
        // Valid: 1 item
        let result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A'] });
        expect(result.success).toBe(true);

        // Valid: 3 items
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A', 'B', 'C'] });
        expect(result.success).toBe(true);

        // Invalid: 0 items
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: [] });
        expect(result.success).toBe(false);

        // Invalid: 4 items
        result = await validateAndProcessValueFor({ ...defaultParams, meta, value: ['A', 'B', 'C', 'A'] });
        expect(result.success).toBe(false);
    });
}); 