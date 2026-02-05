import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import {
	listNotifications,
	markAsRead,
	markAllAsRead,
	getUnreadCount,
	notificationEmitter,
	createNotification,
} from '@imports/data/notifications';
import { createComment } from '@imports/data/comments';
import { getUserSafe } from '@imports/auth/getUser';
import { logger } from '@imports/utils/logger';

// Constants
const SSE_HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds (keeps connection alive past common proxy timeouts)

const notificationApi: FastifyPluginCallback = async fastify => {
	// List notifications
	fastify.get<{ Querystring: { read?: string; page?: string; limit?: string } }>(
		'/rest/notifications',
		async (req, reply) => {
			const result = await listNotifications({
				authTokenId: getAuthTokenIdFromReq(req),
				read: req.query.read !== undefined ? req.query.read === 'true' : undefined,
				page: req.query.page ? parseInt(req.query.page, 10) : undefined,
				limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
			});

			return reply.send(result);
		},
	);

	// Get unread count
	fastify.get('/rest/notifications/unread-count', async (req, reply) => {
		const result = await getUnreadCount({
			authTokenId: getAuthTokenIdFromReq(req),
		});

		return reply.send(result);
	});

	// Mark notification as read
	fastify.put<{ Params: { id: string } }>('/rest/notifications/:id/read', async (req, reply) => {
		const result = await markAsRead({
			authTokenId: getAuthTokenIdFromReq(req),
			notificationId: req.params.id,
		});

		if (result.success === false) {
			const isNotFound = result.errors?.some((e: { message?: string }) => e.message === 'Notification not found');
			return reply.code(isNotFound ? 404 : 400).send(result);
		}
		return reply.send(result);
	});

	// Mark all as read
	fastify.put('/rest/notifications/read-all', async (req, reply) => {
		const result = await markAllAsRead({
			authTokenId: getAuthTokenIdFromReq(req),
		});

		if (result.success === false) {
			return reply.code(400).send(result);
		}
		return reply.send(result);
	});

	// Simulate a notification (development only). Creates a notification and a real comment on the record
	// so the comments panel shows it when opening the form. Optional body: { relatedModule?, relatedDataId? }.
	fastify.post<{ Body: { relatedModule?: string; relatedDataId?: string } }>('/rest/notifications/simulate', async (req, reply) => {
		if (process.env.NODE_ENV === 'production') {
			return reply.code(404).send({ success: false, errors: [{ message: 'Not available in production' }] });
		}

		const authTokenId = getAuthTokenIdFromReq(req);
		const getUserResponse = await getUserSafe(authTokenId);
		if (getUserResponse.success === false) {
			return reply.code(401).send({ success: false, errors: getUserResponse.errors });
		}

		const user = getUserResponse.data;
		const body = (req.body ?? {}) as { relatedModule?: string; relatedDataId?: string };
		const relatedModule = body.relatedModule?.trim() || 'User';
		const relatedDataId = body.relatedDataId?.trim() || user._id;

		const commentResult = await createComment({
			authTokenId,
			document: relatedModule,
			dataId: relatedDataId,
			text: 'Simulated comment for testing',
		});

		if (commentResult.success === false) {
			logger.warn({ errors: commentResult.errors }, 'Simulate: could not create comment (e.g. no Comment collection)');
		}

		const notification = await createNotification({
			userId: user._id,
			type: 'mention',
			relatedModule,
			relatedDataId,
			triggeredBy: user,
			message: 'Simulated notification for testing',
		});

		if (notification == null) {
			return reply.code(500).send({ success: false, errors: [{ message: 'Failed to create notification' }] });
		}

		return reply.send({ success: true, data: notification });
	});

	// SSE endpoint for real-time notifications
	fastify.get('/rest/notifications/stream', async (req: FastifyRequest, reply: FastifyReply) => {
		const authTokenId = getAuthTokenIdFromReq(req);
		const getUserResponse = await getUserSafe(authTokenId);

		if (getUserResponse.success === false) {
			return reply.code(401).send({ success: false, errors: [{ message: 'Unauthorized' }] });
		}

		const userId = getUserResponse.data._id;
		const eventKey = `notification:${userId}`;

		// Set SSE headers
		reply.raw.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no', // Disable nginx buffering
		});

		// Send initial connection message
		reply.raw.write(': connected\n\n');

		// Notification handler
		const notificationHandler = (notification: any) => {
			try {
				reply.raw.write(`data: ${JSON.stringify(notification)}\n\n`);
			} catch (error) {
				logger.error(error, 'Error sending SSE notification');
			}
		};

		// Subscribe to notifications
		notificationEmitter.on(eventKey, notificationHandler);

		// Heartbeat to keep connection alive
		const heartbeatInterval = setInterval(() => {
			try {
				reply.raw.write(': heartbeat\n\n');
			} catch (error) {
				// Connection likely closed
				clearInterval(heartbeatInterval);
			}
		}, SSE_HEARTBEAT_INTERVAL_MS);

		// Cleanup on close
		req.raw.on('close', () => {
			clearInterval(heartbeatInterval);
			notificationEmitter.off(eventKey, notificationHandler);
			logger.debug(`SSE connection closed for user ${userId}`);
		});

		// Keep connection open
		return reply;
	});
};

export default fp(notificationApi);
