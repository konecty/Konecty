import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { subscribe, unsubscribe, getSubscriptionStatus } from '@imports/data/subscriptions';

const subscriptionApi: FastifyPluginCallback = async fastify => {
	// Get subscription status
	fastify.get<{ Params: { module: string; dataId: string } }>(
		'/rest/subscriptions/:module/:dataId',
		async (req, reply) => {
			const result = await getSubscriptionStatus({
				authTokenId: getAuthTokenIdFromReq(req),
				module: req.params.module,
				dataId: req.params.dataId,
			});

			return reply.send(result);
		},
	);

	// Subscribe to a record
	fastify.post<{ Params: { module: string; dataId: string } }>(
		'/rest/subscriptions/:module/:dataId',
		async (req, reply) => {
			const result = await subscribe({
				authTokenId: getAuthTokenIdFromReq(req),
				module: req.params.module,
				dataId: req.params.dataId,
			});

			return reply.send(result);
		},
	);

	// Unsubscribe from a record
	fastify.delete<{ Params: { module: string; dataId: string } }>(
		'/rest/subscriptions/:module/:dataId',
		async (req, reply) => {
			const result = await unsubscribe({
				authTokenId: getAuthTokenIdFromReq(req),
				module: req.params.module,
				dataId: req.params.dataId,
			});

			return reply.send(result);
		},
	);
};

export default fp(subscriptionApi);
