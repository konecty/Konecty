import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import getAccessForDocument from '@imports/access/getAccessForDocument';
import updateAccess, { AccessUpdate } from '@imports/access/updateAccess';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

const accessApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get<{ Params: { document: string } }>('/rest/access/:document', async function (req, reply) {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET getAccess');

		const result = await getAccessForDocument({ document: req.params.document, authTokenId: getAuthTokenIdFromReq(req) ?? 'no-token', tracingSpan });

		tracingSpan.end();
		reply.send(result);
	});

	fastify.post<{ Params: { document: string; accessName: string } }>('/rest/access/:document/:accessName', async function (req, reply) {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('POST updateAccess');

		const result = await updateAccess({
			document: req.params.document,
			authTokenId: getAuthTokenIdFromReq(req) ?? 'no-token',
			accessName: req.params.accessName,
			data: req.body as AccessUpdate,

			tracingSpan,
		});

		tracingSpan.end();
		reply.send(result);
	});

	done();
};

export default fp(accessApi);
