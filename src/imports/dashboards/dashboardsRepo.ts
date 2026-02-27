import { ObjectId, type Collection, type WithId } from 'mongodb';
import pLimit from 'p-limit';

import { db } from '@imports/database';
import {
	type ComposedDashboard,
	type ComposedWidget,
	type Dashboard,
	type CreateDashboardInput,
	type UpdateDashboardInput,
	CreateDashboardInputSchema,
	UpdateDashboardInputSchema,
	DASHBOARD_DEFAULTS,
} from '@imports/model/Dashboard';
import { logger } from '@imports/utils/logger';

// ADR-0012: no-magic-numbers
const DASHBOARD_QUERY_CONCURRENCY = 3;
const COLLECTION_NAME = 'dashboards';

// Composition priority scores (higher = more specific)
const PRIORITY_GROUP_AND_ROLE = 3;
const PRIORITY_GROUP_ONLY = 2;
const PRIORITY_ROLE_ONLY = 1;

// --- Collection accessor ---

const getCollection = (): Collection<Dashboard> => db.collection(COLLECTION_NAME);

// --- Read operations (use projection for lean reads) ---

const getDefaultDashboard = async (): Promise<WithId<Dashboard> | null> => {
	const collection = getCollection();
	const result = await collection.findOne({ scope: 'global', isDefault: true });
	return result;
};

/** Fetch all group-scope extensions matching the user's group name, role name, or legacy group field */
const getMatchingExtensions = async (userGroup: string | null, userRole: string | null): Promise<WithId<Dashboard>[]> => {
	const collection = getCollection();
	const orConditions: Record<string, unknown>[] = [];

	// Match new groups/roles arrays
	if (userGroup != null) {
		orConditions.push({ groups: userGroup });
		orConditions.push({ group: userGroup }); // backward compat
	}
	if (userRole != null) {
		orConditions.push({ roles: userRole });
		orConditions.push({ group: userRole }); // backward compat (legacy stored role name in group field)
	}

	if (orConditions.length === 0) return [];

	const results = await collection.find({ scope: 'group', $or: orConditions }).toArray();
	return results;
};

const getUserPersonal = async (userId: string): Promise<WithId<Dashboard> | null> => {
	const collection = getCollection();
	const result = await collection.findOne({ scope: 'user', owner: userId });
	return result;
};

const getDashboardById = async (id: string): Promise<WithId<Dashboard> | null> => {
	const collection = getCollection();
	const result = await collection.findOne({ _id: new ObjectId(id) as unknown as string });
	return result;
};

const listDashboards = async (): Promise<WithId<Dashboard>[]> => {
	const collection = getCollection();
	const results = await collection.find({}).sort({ scope: 1, isDefault: -1, _createdAt: -1 }).toArray();
	return results;
};

// --- Overlap Validation (ADR-0053: group/role extension uniqueness) ---

/**
 * Check if a new/updated group extension overlaps with an existing one.
 * Two extensions overlap when they have the exact same normalized (groups, roles) combination.
 * Returns the conflicting dashboard if overlap found, null otherwise.
 */
const findOverlappingExtension = async (
	groups: string[],
	roles: string[],
	excludeId?: string,
): Promise<WithId<Dashboard> | null> => {
	const collection = getCollection();

	const sortedGroups = [...groups].sort();
	const sortedRoles = [...roles].sort();

	// Find all scope=group dashboards (excluding current on update)
	const filter: Record<string, unknown> = { scope: 'group' };
	if (excludeId != null) {
		filter._id = { $ne: new ObjectId(excludeId) as unknown as string };
	}

	const existing = await collection.find(filter).toArray();

	// ADR-0012: functional style — find first overlap
	const overlapping = existing.find((ext) => {
		const extGroups = [...(ext.groups ?? [])].sort();
		const extRoles = [...(ext.roles ?? [])].sort();

		// Backward compat: if extension uses legacy `group` field, treat as single-entry groups
		if (extGroups.length === 0 && ext.group != null && ext.group.length > 0) {
			extGroups.push(ext.group);
			extGroups.sort();
		}

		return (
			JSON.stringify(extGroups) === JSON.stringify(sortedGroups) &&
			JSON.stringify(extRoles) === JSON.stringify(sortedRoles)
		);
	});

	return overlapping ?? null;
};

// --- Composition Priority Logic (ADR-0053) ---

/**
 * Score an extension by how specifically it matches the user's group and role.
 * group+role match = 3 (highest), group-only = 2, role-only = 1, no match = 0.
 */
const scoreExtension = (ext: Dashboard, userGroup: string | null, userRole: string | null): number => {
	const extGroups = ext.groups ?? (ext.group != null ? [ext.group] : []);
	const extRoles = ext.roles ?? [];

	const matchesGroup = userGroup != null && extGroups.includes(userGroup);
	const matchesRole = userRole != null && extRoles.includes(userRole);

	if (matchesGroup && matchesRole) return PRIORITY_GROUP_AND_ROLE;
	if (matchesGroup) return PRIORITY_GROUP_ONLY;
	if (matchesRole) return PRIORITY_ROLE_ONLY;
	return 0;
};

/**
 * Select the single most specific extension for a user. Priority: group+role > group > role.
 * If multiple extensions share the same priority, the first found is used (deterministic via DB order).
 */
const selectBestExtension = (extensions: Dashboard[], userGroup: string | null, userRole: string | null): Dashboard | null => {
	if (extensions.length === 0) return null;

	const scored = extensions
		.map((ext) => ({ ext, score: scoreExtension(ext, userGroup, userRole) }))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score);

	return scored.length > 0 ? scored[0].ext : null;
};

// --- Composition (runtime merge) ---

const getComposedDashboard = async (userId: string, userGroup: string | null, userRole: string | null): Promise<ComposedDashboard> => {
	const limit = pLimit(DASHBOARD_QUERY_CONCURRENCY);

	// ADR-0034: p-limit for concurrent queries (not Bluebird)
	const [defaultDash, allExtensions, userPersonal] = await Promise.all([
		limit(() => getDefaultDashboard()),
		limit(() => getMatchingExtensions(userGroup, userRole)),
		limit(() => getUserPersonal(userId)),
	]);

	// ADR-0053: pick the single most-specific extension
	const bestExtension = selectBestExtension(allExtensions, userGroup, userRole);

	// ADR-0012: functional programming (map, flatMap — no for loops)
	const defaultWidgets: ComposedWidget[] = (defaultDash?.widgets ?? []).map((w) => ({
		...w,
		source: 'default' as const,
		locked: true,
		sourceId: defaultDash?._id?.toString() ?? '',
	}));

	const extensionWidgets: ComposedWidget[] = bestExtension != null
		? bestExtension.widgets.map((w) => ({
			...w,
			source: 'group' as const,
			locked: true,
			sourceId: (bestExtension as WithId<Dashboard>)._id?.toString() ?? '',
		}))
		: [];

	const userWidgets: ComposedWidget[] = (userPersonal?.widgets ?? []).map((w) => ({
		...w,
		source: 'user' as const,
		locked: false,
		sourceId: userPersonal?._id?.toString() ?? '',
	}));

	// ADR-0053: inheritsDefault and defaultWidgetPosition
	const inheritsDefault = bestExtension?.inheritsDefault !== false; // default true
	const position = bestExtension?.defaultWidgetPosition ?? 'before';

	const baseWidgets: ComposedWidget[] = (() => {
		if (bestExtension == null) return defaultWidgets; // no extension, show default
		if (!inheritsDefault) return extensionWidgets; // standalone extension
		return position === 'before'
			? [...defaultWidgets, ...extensionWidgets]
			: [...extensionWidgets, ...defaultWidgets];
	})();

	const widgets = [...baseWidgets, ...userWidgets];

	logger.info({ userId, widgetCount: widgets.length, extensionId: (bestExtension as WithId<Dashboard> | null)?._id?.toString() ?? null }, 'Composed dashboard built');

	return {
		defaultDashboard: defaultDash,
		groupExtension: bestExtension,
		groupExtensions: allExtensions,
		userPersonal,
		widgets,
		layout: defaultDash?.layout ?? {
			columns: DASHBOARD_DEFAULTS.GRID_COLUMNS,
			rowHeight: DASHBOARD_DEFAULTS.ROW_HEIGHT,
		},
	};
};

// --- Write operations ---

const createDashboard = async (data: CreateDashboardInput, userId: string): Promise<WithId<Dashboard>> => {
	const parsed = CreateDashboardInputSchema.parse(data);
	const collection = getCollection();

	// ADR-0053: overlap validation for group extensions
	if (parsed.scope === 'group') {
		const groups = parsed.groups ?? (parsed.group != null ? [parsed.group] : []);
		const roles = parsed.roles ?? [];
		const overlap = await findOverlappingExtension(groups, roles);
		if (overlap != null) {
			const error = new Error('A dashboard for this group/role combination already exists');
			(error as Error & { statusCode: number }).statusCode = 409;
			throw error;
		}
	}

	const now = new Date();
	const doc: Dashboard = {
		...parsed,
		_createdBy: userId,
		_updatedBy: userId,
		_createdAt: now,
		_updatedAt: now,
	};

	const result = await collection.insertOne(doc as Parameters<Collection<Dashboard>['insertOne']>[0]);

	logger.info({ dashboardId: result.insertedId, scope: parsed.scope, userId }, 'Dashboard created');

	const inserted = await collection.findOne({ _id: result.insertedId as unknown as string });
	if (inserted == null) {
		throw new Error('Failed to retrieve created dashboard');
	}
	return inserted;
};

const updateDashboard = async (id: string, data: UpdateDashboardInput, userId: string): Promise<WithId<Dashboard> | null> => {
	const parsed = UpdateDashboardInputSchema.parse(data);
	const collection = getCollection();

	// ADR-0053: overlap validation on update if groups/roles changed
	if (parsed.groups != null || parsed.roles != null) {
		const existing = await getDashboardById(id);
		if (existing?.scope === 'group') {
			const groups = parsed.groups ?? existing.groups ?? (existing.group != null ? [existing.group] : []);
			const roles = parsed.roles ?? existing.roles ?? [];
			const overlap = await findOverlappingExtension(groups, roles, id);
			if (overlap != null) {
				const error = new Error('A dashboard for this group/role combination already exists');
				(error as Error & { statusCode: number }).statusCode = 409;
				throw error;
			}
		}
	}

	const updateFields: Record<string, unknown> = {
		...parsed,
		_updatedBy: userId,
		_updatedAt: new Date(),
	};

	const result = await collection.findOneAndUpdate(
		{ _id: new ObjectId(id) as unknown as string },
		{ $set: updateFields, $inc: { version: 1 } },
		{ returnDocument: 'after' },
	);

	logger.info({ dashboardId: id, userId }, 'Dashboard updated');

	return result;
};

const deleteDashboard = async (id: string): Promise<boolean> => {
	const collection = getCollection();

	// Prevent deletion of the default global dashboard
	const dashboard = await getDashboardById(id);
	if (dashboard?.scope === 'global' && dashboard?.isDefault === true) {
		throw new Error('Cannot delete the default dashboard');
	}

	const result = await collection.deleteOne({ _id: new ObjectId(id) as unknown as string });

	logger.info({ dashboardId: id, deleted: result.deletedCount > 0 }, 'Dashboard delete attempted');

	return result.deletedCount > 0;
};

// --- Group Extension ---

interface CreateGroupExtensionInput {
	groups: string[];
	roles: string[];
	inheritsDefault?: boolean;
	defaultWidgetPosition?: 'before' | 'after';
	name?: string;
}

const createGroupExtension = async (input: CreateGroupExtensionInput, parentId: string, userId: string): Promise<WithId<Dashboard>> => {
	const parent = await getDashboardById(parentId);
	if (parent == null) {
		throw new Error('Parent dashboard not found');
	}

	const { groups, roles, inheritsDefault = true, defaultWidgetPosition = 'before', name } = input;

	// ADR-0012: readable label from groups/roles
	const parts = [...groups, ...roles].filter(Boolean);
	const labelSuffix = name ?? (parts.join(' + ') || 'Extension');

	const data: CreateDashboardInput = {
		scope: 'group',
		groups,
		roles,
		inheritsDefault,
		defaultWidgetPosition,
		parentDashboard: parentId,
		isDefault: false,
		label: {
			pt_BR: `Extensão - ${labelSuffix}`,
			en: `Extension - ${labelSuffix}`,
		},
		widgets: [],
		layout: parent.layout,
		version: DASHBOARD_DEFAULTS.VERSION,
	};

	return createDashboard(data, userId);
};

// --- User Personal Layer ---

const createUserPersonal = async (parentId: string, userId: string): Promise<WithId<Dashboard>> => {
	const data: CreateDashboardInput = {
		scope: 'user',
		owner: userId,
		parentDashboard: parentId,
		isDefault: false,
		inheritsDefault: true,
		defaultWidgetPosition: 'before',
		label: {
			pt_BR: 'Meu Painel',
			en: 'My Dashboard',
		},
		layout: {
			columns: DASHBOARD_DEFAULTS.GRID_COLUMNS,
			rowHeight: DASHBOARD_DEFAULTS.ROW_HEIGHT,
		},
		widgets: [],
		version: DASHBOARD_DEFAULTS.VERSION,
	};

	return createDashboard(data, userId);
};

const addWidgetToPersonalLayer = async (userId: string, widget: Dashboard['widgets'][number]): Promise<WithId<Dashboard> | null> => {
	const collection = getCollection();

	// Find or create personal layer
	const existing = await getUserPersonal(userId);

	if (existing == null) {
		// Get default dashboard to reference as parent
		const defaultDash = await getDefaultDashboard();
		const parentId = defaultDash?._id?.toString() ?? '';
		const personal = await createUserPersonal(parentId, userId);
		// Add widget to the newly created personal layer
		const result = await collection.findOneAndUpdate(
			{ _id: personal._id },
			{ $push: { widgets: widget as never }, $set: { _updatedAt: new Date(), _updatedBy: userId } },
			{ returnDocument: 'after' },
		);
		return result;
	}

	const result = await collection.findOneAndUpdate(
		{ _id: existing._id },
		{ $push: { widgets: widget as never }, $set: { _updatedAt: new Date(), _updatedBy: userId } },
		{ returnDocument: 'after' },
	);

	logger.info({ userId, widgetId: widget.i }, 'Widget added to personal layer');

	return result;
};

const removeWidgetFromPersonalLayer = async (userId: string, widgetId: string): Promise<WithId<Dashboard> | null> => {
	const collection = getCollection();

	const result = await collection.findOneAndUpdate(
		{ scope: 'user', owner: userId },
		{ $pull: { widgets: { i: widgetId } as never }, $set: { _updatedAt: new Date(), _updatedBy: userId } },
		{ returnDocument: 'after' },
	);

	logger.info({ userId, widgetId }, 'Widget removed from personal layer');

	return result;
};

// --- Export all functions ---

export const dashboardsRepo = {
	getDefaultDashboard,
	getMatchingExtensions,
	getUserPersonal,
	getDashboardById,
	listDashboards,
	getComposedDashboard,
	createDashboard,
	updateDashboard,
	deleteDashboard,
	createGroupExtension,
	createUserPersonal,
	addWidgetToPersonalLayer,
	removeWidgetFromPersonalLayer,
	findOverlappingExtension,
} as const;
