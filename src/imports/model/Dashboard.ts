import { z } from 'zod';

import { LabelSchema } from './Label';

// ADR-0012: no-magic-numbers — all numeric defaults as named constants
const DEFAULT_GRID_COLUMNS = 12;
const DEFAULT_ROW_HEIGHT = 60;
const DEFAULT_WIDGET_WIDTH = 3;
const DEFAULT_WIDGET_HEIGHT = 2;
const DEFAULT_VERSION = 1;

// --- Widget Config Schemas ---

// KPI widget (aggregation on a Konecty document)
// ADR-0012: no-magic-numbers — default values as constants
const DEFAULT_CACHE_TTL_SECONDS = 300;

const KpiWidgetConfigSchema = z.object({
	type: z.literal('kpi'),
	document: z.string(),
	filter: z.unknown().optional(), // KonFilter serialized
	operation: z.enum(['count', 'sum', 'avg', 'min', 'max', 'percentage']),
	field: z.string().optional(), // required for all except count
	fieldB: z.string().optional(), // required for percentage
	displayName: z.string().optional(), // meta display name for filter context
	displayType: z.string().optional(), // meta display type for filter context
	title: z.string(),
	subtitle: z.string().optional(),
	icon: z.string().optional(),
	iconColor: z.string().optional(),
	format: z.enum(['number', 'currency', 'percent']).default('number'),
	cacheTTL: z.number().default(DEFAULT_CACHE_TTL_SECONDS),
	autoRefresh: z.number().optional(), // in seconds
});

// Widget config schema — extensible for future widget types (chart, list, table)
// When adding new types, expand the discriminatedUnion array.
const WidgetConfigSchema = z.discriminatedUnion('type', [
	KpiWidgetConfigSchema,
]);

// Widget type enum — extend when adding new widget types
const WidgetTypeSchema = z.enum(['kpi']);

// Widget position and size in the grid
export const DashboardWidgetSchema = z.object({
	i: z.string(), // unique widget ID (uuid)
	type: WidgetTypeSchema,
	x: z.number(),
	y: z.number(),
	w: z.number().default(DEFAULT_WIDGET_WIDTH),
	h: z.number().default(DEFAULT_WIDGET_HEIGHT),
	minW: z.number().optional(),
	minH: z.number().optional(),
	config: WidgetConfigSchema,
});

// --- Dashboard Layout Schema ---

const DashboardLayoutSchema = z
	.object({
		columns: z.number().default(DEFAULT_GRID_COLUMNS),
		rowHeight: z.number().default(DEFAULT_ROW_HEIGHT),
	})
	.default({ columns: DEFAULT_GRID_COLUMNS, rowHeight: DEFAULT_ROW_HEIGHT });

// --- Dashboard Scope Enum ---

const DashboardScopeEnum = z.enum(['global', 'group', 'user']);

// --- Main Dashboard Schema ---

export const DashboardSchema = z.object({
	_id: z.string().optional(),
	scope: DashboardScopeEnum,
	isDefault: z.boolean().default(false),
	group: z.string().optional(), // for scope=group: group/role identifier
	owner: z.string().optional(), // for scope=user: userId
	parentDashboard: z.string().optional(), // references default dashboard _id
	label: LabelSchema,
	description: LabelSchema.optional(),
	layout: DashboardLayoutSchema,
	widgets: z.array(DashboardWidgetSchema).default([]),
	version: z.number().default(DEFAULT_VERSION),
	_createdBy: z.string().optional(),
	_updatedBy: z.string().optional(),
	_createdAt: z.date().optional(),
	_updatedAt: z.date().optional(),
});

// --- Create/Update Input Schemas (stricter) ---

export const CreateDashboardInputSchema = DashboardSchema.omit({
	_id: true,
	_createdBy: true,
	_updatedBy: true,
	_createdAt: true,
	_updatedAt: true,
}).refine(
	(data) => {
		// scope=group requires group field
		if (data.scope === 'group' && (data.group == null || data.group.length === 0)) {
			return false;
		}
		// scope=user requires owner field
		if (data.scope === 'user' && (data.owner == null || data.owner.length === 0)) {
			return false;
		}
		return true;
	},
	{
		message: 'Group extensions require group field; user dashboards require owner field',
	},
);

export const UpdateDashboardInputSchema = z.object({
	label: LabelSchema.optional(),
	description: LabelSchema.optional(),
	layout: DashboardLayoutSchema.optional(),
	widgets: z.array(DashboardWidgetSchema).optional(),
});

// --- Inferred Types (DRY: single source of truth via z.infer) ---

export type Dashboard = z.infer<typeof DashboardSchema>;
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;
export type DashboardLayout = z.infer<typeof DashboardLayoutSchema>;
export type CreateDashboardInput = z.infer<typeof CreateDashboardInputSchema>;
export type UpdateDashboardInput = z.infer<typeof UpdateDashboardInputSchema>;

// --- Composed Dashboard Types (runtime merge, not persisted) ---

export type WidgetSource = 'default' | 'group' | 'user';

export interface ComposedWidget extends DashboardWidget {
	source: WidgetSource;
	locked: boolean; // true for default/group widgets
	sourceId: string; // dashboard _id this widget came from
}

export interface ComposedDashboard {
	defaultDashboard: Dashboard | null;
	groupExtensions: Dashboard[];
	userPersonal: Dashboard | null;
	widgets: ComposedWidget[];
	layout: DashboardLayout;
}

// --- Constants re-exported for use in repo/API ---

export const DASHBOARD_DEFAULTS = {
	GRID_COLUMNS: DEFAULT_GRID_COLUMNS,
	ROW_HEIGHT: DEFAULT_ROW_HEIGHT,
	WIDGET_WIDTH: DEFAULT_WIDGET_WIDTH,
	WIDGET_HEIGHT: DEFAULT_WIDGET_HEIGHT,
	VERSION: DEFAULT_VERSION,
} as const;
