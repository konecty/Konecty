import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getUserFromRequest } from '@imports/auth/getUser';
import { getDocument } from '@imports/document';
import { loadMetaObjects } from '@imports/meta/loadMetaObjects';
import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectSchema, MetaObjectType } from '@imports/types/metadata';
import { logger } from '@imports/utils/logger';
import { WithoutId } from 'mongodb';

const documentAPi: FastifyPluginCallback = async fastify => {
	fastify.get<{ Params: { name: string }; Querystring: { type?: keyof typeof MetaObject } }>('/api/document/:name', async (req, reply) => {
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

			const result = await getDocument(name, req.query.type);

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

	fastify.post<{ Params: { id: string } }>('/api/document/:id', async (req, reply) => {
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

			const document = req.body as MetaObjectType;

			if (document == null) {
				return reply.status(400).send('Bad request');
			}

			const parsed = MetaObjectSchema.safeParse(document);

			if (parsed.success === false) {
				logger.error(`Error parsing document: ${parsed.error.errors.map(e => `${e.path}, ${e.code}: ${e.message}`).join('| ')}`);
				return reply.status(400).send('Bad request');
			}

			const result = await MetaObject.MetaObject.replaceOne({ _id: id }, document as WithoutId<MetaObjectType>, { upsert: true });

			if (result.upsertedCount === 1) {
				return reply.status(201).send('Created');
			}

			if (result.modifiedCount === 1) {
				return reply.send('Updated');
			}

			if (result.modifiedCount === 0) {
				return reply.send('Not modified');
			}
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}

			logger.error(error, `Error updating document with id ${id}`);
		}
		return reply.status(500).send('Internal server error');
	});

	fastify.delete<{ Params: { id: string } }>('/api/document/:id', async (req, reply) => {
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

			const result = await MetaObject.MetaObject.deleteOne({ _id: id });

			if (result.deletedCount === 0) {
				return reply.status(404).send('Not found');
			}
			return reply.status(200).send('Deleted');
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}

			logger.error(error, `Error deleting document with id ${id}`);
		}
		return reply.status(500).send('Internal server error');
	});

	fastify.get<{ Params: { id: string } }>('/api/document/rebuild-references', async (req, reply) => {
		if (req.originalUrl == null || req.params == null) {
			return reply.status(404).send('Not found');
		}

		try {
			const user = await getUserFromRequest(req);

			if (user == null || user.admin !== true) {
				return reply.status(401).send('Unauthorized');
			}

			await loadMetaObjects();

			return reply.status(200).send('Rebuilt');
		} catch (error) {
			if (/^\[get-user\]/.test((error as Error).message)) {
				return reply.status(401).send('Unauthorized');
			}

			logger.error(error, `Error rebuilding references`);
		}
		return reply.status(500).send('Internal server error');
	});
};

export default fp(documentAPi);
