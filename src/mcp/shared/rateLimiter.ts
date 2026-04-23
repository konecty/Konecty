import { FastifyInstance } from 'fastify';

const ONE_MINUTE_WINDOW = '1 minute';
const DEFAULT_MAX = 60;
const SESSION_MAX = 10;
const ADMIN_MAX = 30;

export async function registerMcpRateLimitPlugin(fastify: FastifyInstance): Promise<void> {
	await fastify.register(import('@fastify/rate-limit'), {
		global: false,
		timeWindow: ONE_MINUTE_WINDOW,
		max: DEFAULT_MAX,
		enableDraftSpec: true,
	});
}

export function buildUserRouteRateLimit() {
	return {
		rateLimit: {
			timeWindow: ONE_MINUTE_WINDOW,
			max: DEFAULT_MAX,
			keyGenerator: (req: { headers: Record<string, string | string[] | undefined>; ip: string }) =>
				(typeof req.headers['authorization'] === 'string' && req.headers['authorization'].length > 0 ? req.headers['authorization'] : req.ip),
		},
	};
}

export function buildSessionRouteRateLimit() {
	return {
		rateLimit: {
			timeWindow: ONE_MINUTE_WINDOW,
			max: SESSION_MAX,
			keyGenerator: (req: { ip: string }) => req.ip,
		},
	};
}

export function buildAdminRouteRateLimit() {
	return {
		rateLimit: {
			timeWindow: ONE_MINUTE_WINDOW,
			max: ADMIN_MAX,
			keyGenerator: (req: { headers: Record<string, string | string[] | undefined>; ip: string }) =>
				(typeof req.headers['authorization'] === 'string' && req.headers['authorization'].length > 0 ? req.headers['authorization'] : req.ip),
		},
	};
}
