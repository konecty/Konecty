import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { DNE_CEP_List, DNE_City_List, DNE_District_List, DNE_Place_List } from '@imports/dne';

const dneApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.get<{ Params: { cep: string } }>('/rest/dne/cep/:cep', async function (req, reply) {
		const result = await DNE_CEP_List(req.params.cep);
		reply.send(result);
	});

	fastify.get<{ Params: { state: string; city: string } }>('/rest/dne/BRA/:state/:city', async function (req, reply) {
		const result = await DNE_City_List(req.params.state, req.params.city);
		reply.send(result);
	});

	fastify.get<{ Params: { state: string; city: string; district: string } }>('/rest/dne/BRA/:state/:city/:district', async function (req, reply) {
		const result = await DNE_District_List(req.params.state, req.params.city, req.params.district);
		reply.send(result);
	});

	fastify.get<{ Params: { state: string; city: string; district: string; place: string; number?: string } }>(
		'/rest/dne/BRA/:state/:city/:district/:place/:number',
		async function (req, reply) {
			const result = await DNE_Place_List(req.params.state, req.params.city, req.params.district, req.params.place, req.params.number);
			reply.send(result);
		},
	);

	fastify.get<{ Params: { state: string; city: string; district: string; place: string; number: string; limit: string } }>(
		'/rest/dne/BRA/:state/:city/:district/:place/:number/:limit',
		async function (req, reply) {
			const result = await DNE_Place_List(req.params.state, req.params.city, req.params.district, req.params.place, req.params.number, req.params.limit);
			reply.send(result);
		},
	);

	done();
};

export default fp(dneApi);
