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

// --- Collection accessor ---

const getCollection = (): Collection<Dashboard> => db.collection(COLLECTION_NAME);

// --- Read operations (use projection for lean reads) ---

const getDefaultDashboard = async (): Promise<WithId<Dashboard> | null> => {
	const collection = getCollection();
	const result = await collection.findOne({ scope: 'global', isDefault: true });
	return result;
};

const getGroupExtensions = async (groups: string[]): Promise<WithId<Dashboard>[]> => {
	const collection = getCollection();
	const results = await collection.find({ scope: 'group', group: { $in: groups } }).toArray();
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

// --- Composition (runtime merge) ---

const getComposedDashboard = async (userId: string, userGroups: string[]): Promise<ComposedDashboard> => {
	const limit = pLimit(DASHBOARD_QUERY_CONCURRENCY);

	// ADR-0034: p-limit for concurrent queries (not Bluebird)
	const [defaultDash, groupExtensions, userPersonal] = await Promise.all([
		limit(() => getDefaultDashboard()),
		limit(() => getGroupExtensions(userGroups)),
		limit(() => getUserPersonal(userId)),
	]);

	// ADR-0012: functional programming (map, flatMap — no for loops)
	const defaultWidgets: ComposedWidget[] = (defaultDash?.widgets ?? []).map((w) => ({
		...w,
		source: 'default' as const,
		locked: true,
		sourceId: defaultDash?._id?.toString() ?? '',
	}));

	const groupWidgets: ComposedWidget[] = groupExtensions.flatMap((ext) =>
		ext.widgets.map((w) => ({
			...w,
			source: 'group' as const,
			locked: true,
			sourceId: ext._id.toString(),
		})),
	);

	const userWidgets: ComposedWidget[] = (userPersonal?.widgets ?? []).map((w) => ({
		...w,
		source: 'user' as const,
		locked: false,
		sourceId: userPersonal?._id?.toString() ?? '',
	}));

	const widgets = [...defaultWidgets, ...groupWidgets, ...userWidgets];

	logger.info({ userId, widgetCount: widgets.length }, 'Composed dashboard built');

	return {
		defaultDashboard: defaultDash,
		groupExtensions,
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

const createGroupExtension = async (group: string, parentId: string, userId: string): Promise<WithId<Dashboard>> => {
	const parent = await getDashboardById(parentId);
	if (parent == null) {
		throw new Error('Parent dashboard not found');
	}

	const data: CreateDashboardInput = {
		scope: 'group',
		group,
		parentDashboard: parentId,
		isDefault: false,
		label: {
			pt_BR: `Extensao - ${group}`,
			en: `Extension - ${group}`,
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
	getGroupExtensions,
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
} as const;
