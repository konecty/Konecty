import {
	DashboardSchema,
	DashboardWidgetSchema,
	CreateDashboardInputSchema,
	UpdateDashboardInputSchema,
	DASHBOARD_DEFAULTS,
} from './Dashboard';

describe('Dashboard Model', () => {
	describe('DashboardWidgetSchema', () => {
		it('parses a valid placeholder widget', () => {
			const widget = {
				i: 'widget-1',
				type: 'placeholder' as const,
				x: 0,
				y: 0,
				w: 3,
				h: 2,
				config: { type: 'placeholder' as const },
			};

			const result = DashboardWidgetSchema.parse(widget);
			expect(result.i).toBe('widget-1');
			expect(result.type).toBe('placeholder');
			expect(result.w).toBe(3);
			expect(result.h).toBe(2);
		});

		it('applies default width and height', () => {
			const widget = {
				i: 'widget-2',
				type: 'placeholder' as const,
				x: 0,
				y: 0,
				config: { type: 'placeholder' as const },
			};

			const result = DashboardWidgetSchema.parse(widget);
			expect(result.w).toBe(DASHBOARD_DEFAULTS.WIDGET_WIDTH);
			expect(result.h).toBe(DASHBOARD_DEFAULTS.WIDGET_HEIGHT);
		});

		it('rejects invalid widget type', () => {
			const widget = {
				i: 'widget-3',
				type: 'kpi',
				x: 0,
				y: 0,
				config: { type: 'kpi' },
			};

			const result = DashboardWidgetSchema.safeParse(widget);
			expect(result.success).toBe(false);
		});
	});

	describe('DashboardSchema', () => {
		it('parses a valid global dashboard', () => {
			const dashboard = {
				scope: 'global' as const,
				isDefault: true,
				label: { pt_BR: 'Painel', en: 'Dashboard' },
				widgets: [],
			};

			const result = DashboardSchema.parse(dashboard);
			expect(result.scope).toBe('global');
			expect(result.isDefault).toBe(true);
			expect(result.layout.columns).toBe(DASHBOARD_DEFAULTS.GRID_COLUMNS);
			expect(result.layout.rowHeight).toBe(DASHBOARD_DEFAULTS.ROW_HEIGHT);
			expect(result.version).toBe(DASHBOARD_DEFAULTS.VERSION);
		});

		it('parses a valid group dashboard', () => {
			const dashboard = {
				scope: 'group' as const,
				group: 'sales',
				parentDashboard: 'parent-id',
				label: { pt_BR: 'Vendas', en: 'Sales' },
				widgets: [],
			};

			const result = DashboardSchema.parse(dashboard);
			expect(result.scope).toBe('group');
			expect(result.group).toBe('sales');
		});

		it('parses a valid user dashboard', () => {
			const dashboard = {
				scope: 'user' as const,
				owner: 'user-123',
				parentDashboard: 'parent-id',
				label: { pt_BR: 'Meu Painel', en: 'My Dashboard' },
				widgets: [],
			};

			const result = DashboardSchema.parse(dashboard);
			expect(result.scope).toBe('user');
			expect(result.owner).toBe('user-123');
		});

		it('rejects invalid scope', () => {
			const dashboard = {
				scope: 'invalid',
				label: { pt_BR: 'Test', en: 'Test' },
			};

			const result = DashboardSchema.safeParse(dashboard);
			expect(result.success).toBe(false);
		});
	});

	describe('CreateDashboardInputSchema', () => {
		it('rejects group scope without group field', () => {
			const data = {
				scope: 'group' as const,
				label: { pt_BR: 'Test', en: 'Test' },
				widgets: [],
			};

			const result = CreateDashboardInputSchema.safeParse(data);
			expect(result.success).toBe(false);
		});

		it('rejects user scope without owner field', () => {
			const data = {
				scope: 'user' as const,
				label: { pt_BR: 'Test', en: 'Test' },
				widgets: [],
			};

			const result = CreateDashboardInputSchema.safeParse(data);
			expect(result.success).toBe(false);
		});

		it('accepts group scope with group field', () => {
			const data = {
				scope: 'group' as const,
				group: 'sales',
				label: { pt_BR: 'Test', en: 'Test' },
				widgets: [],
			};

			const result = CreateDashboardInputSchema.safeParse(data);
			expect(result.success).toBe(true);
		});

		it('accepts user scope with owner field', () => {
			const data = {
				scope: 'user' as const,
				owner: 'user-123',
				label: { pt_BR: 'Test', en: 'Test' },
				widgets: [],
			};

			const result = CreateDashboardInputSchema.safeParse(data);
			expect(result.success).toBe(true);
		});
	});

	describe('UpdateDashboardInputSchema', () => {
		it('accepts partial updates', () => {
			const data = {
				label: { en: 'Updated' },
			};

			const result = UpdateDashboardInputSchema.parse(data);
			expect(result.label).toEqual({ en: 'Updated' });
		});

		it('accepts empty object', () => {
			const result = UpdateDashboardInputSchema.parse({});
			expect(result).toBeDefined();
		});
	});

	describe('DASHBOARD_DEFAULTS', () => {
		it('has correct default values', () => {
			expect(DASHBOARD_DEFAULTS.GRID_COLUMNS).toBe(12);
			expect(DASHBOARD_DEFAULTS.ROW_HEIGHT).toBe(60);
			expect(DASHBOARD_DEFAULTS.WIDGET_WIDTH).toBe(3);
			expect(DASHBOARD_DEFAULTS.WIDGET_HEIGHT).toBe(2);
			expect(DASHBOARD_DEFAULTS.VERSION).toBe(1);
		});
	});
});
