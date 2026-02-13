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

/** Sub-query schema for percentage numerator/denominator — same document as parent */
const KpiSubQuerySchema = z.object({
	operation: z.enum(['count', 'sum', 'avg', 'min', 'max']),
	field: z.string().optional(), // required for non-count
	filter: z.unknown().optional(), // KonFilter independente
});

// Graph config schema for chart widgets — matches @imports/types/graph GraphConfig
const GraphConfigSchema = z
	.object({
		type: z.enum(['bar', 'line', 'pie', 'scatter', 'histogram', 'timeSeries']),
		xAxis: z
			.object({ field: z.string(), label: z.string().optional(), bucket: z.string().optional() })
			.optional(),
		yAxis: z
			.object({ field: z.string(), label: z.string().optional(), bucket: z.string().optional() })
			.optional(),
		series: z
			.array(
				z.object({
					field: z.string(),
					label: z.string().optional(),
					aggregation: z.enum(['count', 'sum', 'avg', 'min', 'max']).optional(),
					color: z.string().optional(),
					bucket: z.string().optional(),
				}),
			)
			.optional(),
		categoryField: z.string().optional(),
		aggregation: z.enum(['count', 'sum', 'avg', 'min', 'max']).optional(),
		colors: z.array(z.string()).optional(),
		showLegend: z.boolean().optional(),
		showGrid: z.boolean().optional(),
		title: z.string().optional(),
		width: z.number().optional(),
		height: z.number().optional(),
	})
	.passthrough(); // allow histogram, categoryFieldBucket, etc.

const ChartWidgetConfigSchema = z.object({
	type: z.literal('chart'),
	document: z.string().min(1),
	filter: z.any().optional(),
	graphConfig: GraphConfigSchema,
	title: z.string().min(1),
	subtitle: z.string().optional(),
	cacheTTL: z.number().min(0).default(DEFAULT_CACHE_TTL_SECONDS),
	autoRefresh: z.number().min(0).optional(),
});

const KpiWidgetConfigSchema = z.object({
	type: z.literal('kpi'),
	document: z.string(),
	filter: z.unknown().optional(), // KonFilter serialized (non-percentage)
	operation: z.enum(['count', 'sum', 'avg', 'min', 'max', 'percentage']),
	field: z.string().optional(), // required for all except count (non-percentage)
	displayName: z.string().optional(), // meta display name for filter context
	displayType: z.string().optional(), // meta display type for filter context
	title: z.string(),
	subtitle: z.string().optional(),
	icon: z.string().optional(),
	iconColor: z.string().optional(),
	format: z.enum(['number', 'currency', 'percent']).default('number'),
	cacheTTL: z.number().default(DEFAULT_CACHE_TTL_SECONDS),
	autoRefresh: z.number().optional(), // in seconds
	// For percentage: two sub-queries on the same document
	numerator: KpiSubQuerySchema.optional(),
	denominator: KpiSubQuerySchema.optional(),
});

// List widget column schema
const ListWidgetColumnSchema = z.object({
	field: z.string().min(1),
	label: z.string().optional(),
	width: z.number().optional(),
});

const DEFAULT_LIST_LIMIT = 10;
const DEFAULT_LIST_CACHE_TTL_SECONDS = 60;

const ListWidgetConfigSchema = z.object({
	type: z.literal('list'),
	document: z.string().min(1),
	filter: z.any().optional(),
	columns: z.array(ListWidgetColumnSchema).min(1),
	sort: z.string().optional(),
	limit: z.number().min(1).default(DEFAULT_LIST_LIMIT),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	cacheTTL: z.number().min(0).default(DEFAULT_LIST_CACHE_TTL_SECONDS),
	autoRefresh: z.number().min(0).optional(),
	displayName: z.string().optional(),
	displayType: z.string().optional(),
});

// --- Table Widget (Pivot Table) Schemas ---

// ADR-0012: no-magic-numbers
const DEFAULT_TABLE_CACHE_TTL_SECONDS = 300;

const PivotRowItemSchema = z.object({
	field: z.string().min(1),
	order: z.enum(['ASC', 'DESC']).default('ASC'),
	showSubtotal: z.boolean().optional(),
	width: z.number().optional(),
});

const PivotColumnItemSchema = z.object({
	field: z.string().min(1),
	aggregator: z.enum(['D', 'W', 'M', 'Q', 'Y']).optional(),
	order: z.enum(['ASC', 'DESC']).default('ASC'),
	width: z.number().optional(),
});

const PivotValueItemSchema = z.object({
	field: z.string().min(1),
	aggregator: z.enum(['count', 'sum', 'avg', 'min', 'max']),
	format: z.string().optional(),
	width: z.number().optional(),
});

const PivotOptionsSchema = z
	.object({
		showRowGrandTotals: z.boolean().optional(),
		showColGrandTotals: z.boolean().optional(),
		showRowSubtotals: z.boolean().optional(),
		showColSubtotals: z.boolean().optional(),
		enableGrouping: z.boolean().optional(),
		hideGroupedLeftAxisCols: z.boolean().optional(),
	})
	.optional();

const EditedPivotConfigSchema = z.object({
	rows: z.array(PivotRowItemSchema).min(1),
	columns: z.array(PivotColumnItemSchema).optional(),
	values: z.array(PivotValueItemSchema).min(1),
	options: PivotOptionsSchema,
});

const TableWidgetConfigSchema = z.object({
	type: z.literal('table'),
	document: z.string().min(1),
	filter: z.any().optional(),
	pivotConfig: EditedPivotConfigSchema,
	title: z.string().default(''),
	subtitle: z.string().optional(),
	cacheTTL: z.number().min(0).default(DEFAULT_TABLE_CACHE_TTL_SECONDS),
	autoRefresh: z.number().min(0).optional(),
	displayName: z.string().optional(),
	displayType: z.string().optional(),
});

// --- Card List Widget Schema (ADR-0052) ---

const DEFAULT_CARDLIST_LIMIT = 10;
const DEFAULT_CARDLIST_CACHE_TTL_SECONDS = 60;

const TypographyStyleSchema = z.object({
	preset: z.enum(['title', 'subtitle', 'body', 'caption', 'overline']).optional(),
	bold: z.boolean().optional(),
	italic: z.boolean().optional(),
	underline: z.boolean().optional(),
	strikethrough: z.boolean().optional(),
	align: z.enum(['left', 'center', 'right']).optional(),
	color: z.string().optional(),
});

const CardCellElementSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('field'), field: z.string(), typography: TypographyStyleSchema.optional(), wrap: z.boolean().optional() }),
	z.object({ kind: z.literal('image'), field: z.string(), aspectRatio: z.enum(['1:1', '4:3', '16:9', '3:4', '3:2', '2:1']).optional() }),
	z.object({ kind: z.literal('text'), value: z.string(), typography: TypographyStyleSchema.optional() }),
	z.object({ kind: z.literal('link'), text: z.string(), url: z.string(), alt: z.string().optional(), typography: TypographyStyleSchema.optional() }),
	z.object({ kind: z.literal('button'), text: z.string(), url: z.string(), icon: z.string().optional(), color: z.string().optional(), variant: z.enum(['solid', 'outline']).optional() }),
	z.object({ kind: z.literal('formula'), expression: z.string(), label: z.string().optional(), typography: TypographyStyleSchema.optional() }),
	z.object({ kind: z.literal('badge'), field: z.string(), colorMap: z.record(z.string()).optional() }),
	z.object({ kind: z.literal('separator') }),
	z.object({ kind: z.literal('spacer'), height: z.number().optional() }),
]);

const CardTemplateCellSchema = z.object({
	id: z.string(),
	width: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
	element: CardCellElementSchema,
});

const CardTemplateRowSchema = z.object({
	id: z.string(),
	cells: z.array(CardTemplateCellSchema),
});

const CardTemplateSchema = z.object({
	rows: z.array(CardTemplateRowSchema),
	background: z.union([
		z.object({ type: z.literal('color'), value: z.string() }),
		z.object({ type: z.literal('image'), field: z.string() }),
	]).optional(),
	borderRadius: z.number().optional(),
	padding: z.number().optional(),
});

const CardListWidgetConfigSchema = z.object({
	type: z.literal('cardList'),
	document: z.string().min(1),
	filter: z.any().optional(),
	columns: z.array(z.string()),
	sort: z.string().optional(),
	limit: z.number().min(1).default(DEFAULT_CARDLIST_LIMIT),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	cacheTTL: z.number().min(0).default(DEFAULT_CARDLIST_CACHE_TTL_SECONDS),
	autoRefresh: z.number().min(0).optional(),
	displayName: z.string().optional(),
	displayType: z.string().optional(),
	form: z.string().optional(),
	template: CardTemplateSchema,
	layoutMode: z.enum(['grid', 'list']),
	gridColumns: z.number().optional(),
	cardMinWidth: z.number().optional(),
});

// --- Content Widget Schema (ADR-0050) ---

const ContentImageSchema = z.object({
	url: z.string(),
	alt: z.string().optional(),
});

const ContentWidgetConfigSchema = z.object({
	type: z.literal('content'),
	contentType: z.enum(['html', 'markdown']),
	content: z.string().default(''),
	title: z.string().default(''),
	subtitle: z.string().optional(),
	// Optional link
	link: z.string().optional(),
	linkLabel: z.string().optional(),
	linkTarget: z.enum(['_blank', '_self', '_parent', '_top']).optional(),
	// Optional images (CDN URLs)
	images: z.array(ContentImageSchema).optional(),
	// Visibility scheduling (optional — when absent, always visible)
	startAt: z.string().datetime().optional(),
	endAt: z.string().datetime().optional(),
	// Provenance (informational only, not used at render time)
	webElementId: z.string().optional(),
});

// Widget config schema — extensible for future widget types
// When adding new types, expand the discriminatedUnion array.
const WidgetConfigSchema = z.discriminatedUnion('type', [
	KpiWidgetConfigSchema,
	ChartWidgetConfigSchema,
	ListWidgetConfigSchema,
	TableWidgetConfigSchema,
	ContentWidgetConfigSchema,
	CardListWidgetConfigSchema,
]);

// Widget type enum — extend when adding new widget types
const WidgetTypeSchema = z.enum(['kpi', 'chart', 'list', 'table', 'content', 'cardList']);

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

// --- Default Widget Position ---

const DefaultWidgetPositionSchema = z.enum(['before', 'after']);

// --- Main Dashboard Schema ---

export const DashboardSchema = z.object({
	_id: z.string().optional(),
	scope: DashboardScopeEnum,
	isDefault: z.boolean().default(false),
	group: z.string().optional(), // DEPRECATED: kept for backward compat; prefer groups/roles
	groups: z.array(z.string()).optional(), // for scope=group: Group names
	roles: z.array(z.string()).optional(), // for scope=group: Role names
	owner: z.string().optional(), // for scope=user: userId
	parentDashboard: z.string().optional(), // references default dashboard _id
	inheritsDefault: z.boolean().default(true), // scope=group: merge widgets from default
	defaultWidgetPosition: DefaultWidgetPositionSchema.default('before'), // scope=group: default widgets before or after extension widgets
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
		if (data.scope === 'group') {
			// scope=group requires at least one group or role
			const hasGroups = Array.isArray(data.groups) && data.groups.length > 0;
			const hasRoles = Array.isArray(data.roles) && data.roles.length > 0;
			const hasLegacyGroup = data.group != null && data.group.length > 0;
			return hasGroups || hasRoles || hasLegacyGroup;
		}
		// scope=user requires owner field
		if (data.scope === 'user' && (data.owner == null || data.owner.length === 0)) {
			return false;
		}
		return true;
	},
	{
		message: 'Group extensions require at least one group or role; user dashboards require owner field',
	},
);

export const UpdateDashboardInputSchema = z.object({
	label: LabelSchema.optional(),
	description: LabelSchema.optional(),
	layout: DashboardLayoutSchema.optional(),
	widgets: z.array(DashboardWidgetSchema).optional(),
	groups: z.array(z.string()).optional(),
	roles: z.array(z.string()).optional(),
	inheritsDefault: z.boolean().optional(),
	defaultWidgetPosition: DefaultWidgetPositionSchema.optional(),
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
	groupExtension: Dashboard | null; // single most-specific extension (priority: group+role > group > role)
	groupExtensions: Dashboard[]; // all matching extensions (for admin reference)
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
