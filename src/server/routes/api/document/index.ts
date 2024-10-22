import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getUserFromRequest } from '@imports/auth/getUser';
import { getDocument } from '@imports/document';
import { logger } from '@imports/utils/logger';
import { db } from '@imports/database';
import { ObjectId } from 'mongodb';

const documentAPi: FastifyPluginCallback = async fastify => {
	fastify.get<{ Params: { name: string } }>('/api/document/:name', async (req, reply) => {
		if (req.originalUrl == null || req.params == null) {
			return reply.status(404).send('Not found');
		}

		const name = req.params.name;

		if (name == null) {
			return reply.status(400).send('Bad request');
		}

		try {
			const user = await getUserFromRequest(req);

			if (user == null) {
				return reply.status(401).send('Unauthorized');
			}

			const result = await getDocument(name);

			if (result == null) {
				return reply.status(404).send('Invalid meta object');
			}

			return reply.send(result);
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}

			logger.error(error, `Error getting document for ${name}`);
			return reply.status(500).send('Internal server error');
		}
	});

	fastify.put<{ Params: { id: string } }>('/api/document/:id', async (req, reply) => {
		if (req.originalUrl == null || req.params == null) {
			return reply.status(404).send('Not found');
		}

		const id = req.params.id;

		if (id == null) {
			return reply.status(400).send('Bad request');
		}

		try {
			const user = await getUserFromRequest(req);

			if (user == null || user.admin !== true) {
				return reply.status(401).send('Unauthorized');
			}

			const document = req.body as object;

			if (document == null) {
				return reply.status(400).send('Bad request');
			}

			const result = await db.collection('MetaObjects').replaceOne({ _id: new ObjectId(id) }, document, { upsert: true });

			if (result.modifiedCount === 0) {
				return reply.status(404).send('Invalid meta object');
			}

			if (result.upsertedCount === 1) {
				return reply.status(201).send('Created');
			}

			if (result.matchedCount === 1) {
				return reply.send('Updated');
			}
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}

			logger.error(error, `Error getting document for ${id}`);
		}
		return reply.status(500).send('Internal server error');
	});
};

export default fp(documentAPi);
