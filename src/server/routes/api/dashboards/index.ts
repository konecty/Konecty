import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getUserFromRequest } from '@imports/auth/getUser';
import { dashboardsRepo } from '@imports/dashboards/dashboardsRepo';
import { CreateDashboardInputSchema, UpdateDashboardInputSchema, DashboardWidgetSchema } from '@imports/model/Dashboard';
import { logger } from '@imports/utils/logger';

// ADR-0012: no-magic-numbers
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_ERROR = 500;

const dashboardsApi: FastifyPluginCallback = async (fastify) => {
	// --- GET /api/dashboards --- List all dashboards (admin sees all)
	fastify.get('/api/dashboards', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			if (user.admin !== true) {
				return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message: 'Admin access required' }] });
			}

			const dashboards = await dashboardsRepo.listDashboards();
			return reply.status(HTTP_OK).send({ success: true, data: dashboards });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			logger.error(error, 'Error listing dashboards');
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});

	// --- GET /api/dashboards/composed --- Get composed dashboard for current user
	fastify.get('/api/dashboards/composed', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			// ADR-0053: pass group and role separately for priority-based composition
			const userGroup = user.group?.name ?? null;
			const userRole = user.role?.name ?? null;

			const userId = user._id;
			const composed = await dashboardsRepo.getComposedDashboard(userId, userGroup, userRole);
			return reply.status(HTTP_OK).send({ success: true, data: composed });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			logger.error(error, 'Error getting composed dashboard');
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});

	// --- GET /api/dashboards/:id --- Get specific dashboard document (admin)
	fastify.get<{ Params: { id: string } }>('/api/dashboards/:id', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			if (user.admin !== true) {
				return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message: 'Admin access required' }] });
			}

			const dashboard = await dashboardsRepo.getDashboardById(req.params.id);
			if (dashboard == null) {
				return reply.status(HTTP_NOT_FOUND).send({ success: false, errors: [{ message: 'Dashboard not found' }] });
			}

			return reply.status(HTTP_OK).send({ success: true, data: dashboard });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			logger.error(error, `Error getting dashboard ${req.params.id}`);
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});

	// --- POST /api/dashboards --- Create dashboard (admin)
	fastify.post('/api/dashboards', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			if (user.admin !== true) {
				return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message: 'Admin access required' }] });
			}

			const parseResult = CreateDashboardInputSchema.safeParse(req.body);
			if (parseResult.success === false) {
				const errorMessages = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
				logger.error({ errors: errorMessages }, 'Dashboard validation failed');
				return reply.status(HTTP_BAD_REQUEST).send({ success: false, errors: errorMessages.map((m) => ({ message: m })) });
			}

			const dashboard = await dashboardsRepo.createDashboard(parseResult.data, user._id);
			return reply.status(HTTP_CREATED).send({ success: true, data: dashboard });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			// ADR-0053: overlap detection returns 409
			const statusCode = (error as Error & { statusCode?: number }).statusCode;
			if (statusCode === HTTP_CONFLICT) {
				return reply.status(HTTP_CONFLICT).send({ success: false, errors: [{ message: (error as Error).message }] });
			}
			logger.error(error, 'Error creating dashboard');
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});

	// --- PUT /api/dashboards/:id --- Update dashboard (admin for global/group, owner for user)
	fastify.put<{ Params: { id: string } }>('/api/dashboards/:id', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			const existing = await dashboardsRepo.getDashboardById(req.params.id);
			if (existing == null) {
				return reply.status(HTTP_NOT_FOUND).send({ success: false, errors: [{ message: 'Dashboard not found' }] });
			}

			// Permission check: admin for global/group, owner for user scope
			if (existing.scope === 'user') {
				if (existing.owner !== user._id && user.admin !== true) {
					return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message: 'Forbidden' }] });
				}
			} else if (user.admin !== true) {
				return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message: 'Admin access required' }] });
			}

			const parseResult = UpdateDashboardInputSchema.safeParse(req.body);
			if (parseResult.success === false) {
				const errorMessages = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
				return reply.status(HTTP_BAD_REQUEST).send({ success: false, errors: errorMessages.map((m) => ({ message: m })) });
			}

			const updated = await dashboardsRepo.updateDashboard(req.params.id, parseResult.data, user._id);
			return reply.status(HTTP_OK).send({ success: true, data: updated });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			// ADR-0053: overlap detection returns 409
			const statusCode = (error as Error & { statusCode?: number }).statusCode;
			if (statusCode === HTTP_CONFLICT) {
				return reply.status(HTTP_CONFLICT).send({ success: false, errors: [{ message: (error as Error).message }] });
			}
			logger.error(error, `Error updating dashboard ${req.params.id}`);
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});

	// --- DELETE /api/dashboards/:id --- Delete dashboard (admin for global/group, owner for user)
	fastify.delete<{ Params: { id: string } }>('/api/dashboards/:id', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			const existing = await dashboardsRepo.getDashboardById(req.params.id);
			if (existing == null) {
				return reply.status(HTTP_NOT_FOUND).send({ success: false, errors: [{ message: 'Dashboard not found' }] });
			}

			// Permission check
			if (existing.scope === 'user') {
				if (existing.owner !== user._id && user.admin !== true) {
					return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message: 'Forbidden' }] });
				}
			} else if (user.admin !== true) {
				return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message: 'Admin access required' }] });
			}

			const deleted = await dashboardsRepo.deleteDashboard(req.params.id);
			if (!deleted) {
				return reply.status(HTTP_NOT_FOUND).send({ success: false, errors: [{ message: 'Dashboard not found or cannot be deleted' }] });
			}

			return reply.status(HTTP_OK).send({ success: true });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			const message = (error as Error).message;
			if (message === 'Cannot delete the default dashboard') {
				return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message }] });
			}
			logger.error(error, `Error deleting dashboard ${req.params.id}`);
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});

	// --- POST /api/dashboards/:id/extend --- Create group/role extension from a dashboard (admin)
	fastify.post<{
		Params: { id: string };
		Body: {
			groups?: string[];
			roles?: string[];
			inheritsDefault?: boolean;
			defaultWidgetPosition?: 'before' | 'after';
			name?: string;
			group?: string; // backward compat
		};
	}>('/api/dashboards/:id/extend', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			if (user.admin !== true) {
				return reply.status(HTTP_FORBIDDEN).send({ success: false, errors: [{ message: 'Admin access required' }] });
			}

			const body = req.body ?? {};
			// ADR-0053: support new groups/roles fields; backward compat with legacy { group }
			const groups = body.groups ?? (body.group != null ? [body.group] : []);
			const roles = body.roles ?? [];

			if (groups.length === 0 && roles.length === 0) {
				return reply.status(HTTP_BAD_REQUEST).send({ success: false, errors: [{ message: 'At least one group or role is required' }] });
			}

			const extension = await dashboardsRepo.createGroupExtension(
				{
					groups,
					roles,
					inheritsDefault: body.inheritsDefault,
					defaultWidgetPosition: body.defaultWidgetPosition,
					name: body.name,
				},
				req.params.id,
				user._id,
			);
			return reply.status(HTTP_CREATED).send({ success: true, data: extension });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			// ADR-0053: overlap detection returns 409
			const statusCode = (error as Error & { statusCode?: number }).statusCode;
			if (statusCode === HTTP_CONFLICT) {
				return reply.status(HTTP_CONFLICT).send({ success: false, errors: [{ message: (error as Error).message }] });
			}
			logger.error(error, `Error creating group extension for dashboard ${req.params.id}`);
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});

	// --- POST /api/dashboards/personal/widget --- Add widget to user's personal layer
	fastify.post('/api/dashboards/personal/widget', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			const parseResult = DashboardWidgetSchema.safeParse(req.body);
			if (parseResult.success === false) {
				const errorMessages = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
				return reply.status(HTTP_BAD_REQUEST).send({ success: false, errors: errorMessages.map((m) => ({ message: m })) });
			}

			const result = await dashboardsRepo.addWidgetToPersonalLayer(user._id, parseResult.data);
			return reply.status(HTTP_CREATED).send({ success: true, data: result });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			logger.error(error, 'Error adding widget to personal layer');
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});

	// --- DELETE /api/dashboards/personal/widget/:widgetId --- Remove widget from personal layer
	fastify.delete<{ Params: { widgetId: string } }>('/api/dashboards/personal/widget/:widgetId', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}

			const result = await dashboardsRepo.removeWidgetFromPersonalLayer(user._id, req.params.widgetId);
			if (result == null) {
				return reply.status(HTTP_NOT_FOUND).send({ success: false, errors: [{ message: 'Personal dashboard or widget not found' }] });
			}

			return reply.status(HTTP_OK).send({ success: true, data: result });
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(HTTP_UNAUTHORIZED).send({ success: false, errors: [{ message: 'Unauthorized' }] });
			}
			logger.error(error, `Error removing widget ${req.params.widgetId} from personal layer`);
			return reply.status(HTTP_INTERNAL_ERROR).send({ success: false, errors: [{ message: 'Internal server error' }] });
		}
	});
};

export default fp(dashboardsApi);
