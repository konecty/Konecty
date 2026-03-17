import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getUserFromRequest } from '@imports/auth/getUser';
import { loadMetaObjects } from '@imports/meta/loadMetaObjects';
import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';

const HOOK_FIELDS = ['scriptBeforeValidation', 'validationScript', 'scriptAfterSave', 'validationData'] as const;

const META_TYPES = ['document', 'composite', 'list', 'view', 'access', 'pivot', 'card', 'namespace'] as const;

type HookName = (typeof HOOK_FIELDS)[number];

function isValidHookName(name: string): name is HookName {
	return HOOK_FIELDS.includes(name as HookName);
}

function buildMetaId(document: string, type: string, name: string): string {
	if (type === 'document' || type === 'composite') {
		return document;
	}
	return `${document}:${type}:${name}`;
}

const metaAdminApi: FastifyPluginCallback = async fastify => {
	fastify.addHook('preHandler', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null || user.admin !== true) {
				return reply.status(401).send({ success: false, errors: ['Admin access required'] });
			}
			(req as any).adminUser = user;
		} catch (error) {
			return reply.status(401).send({ success: false, errors: ['Unauthorized'] });
		}
	});

	fastify.get('/', async (_req, reply) => {
		try {
			const documents = await MetaObject.MetaObject.find(
				{ type: { $in: ['document', 'composite'] } },
				{ projection: { _id: 1, name: 1, type: 1, label: 1 } },
			).toArray();

			return reply.send({ success: true, data: documents });
		} catch (error) {
			logger.error(error, 'Error listing meta documents');
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.get<{ Params: { document: string } }>('/:document', async (req, reply) => {
		try {
			const { document } = req.params;

			const metas = await MetaObject.MetaObject.find(
				{
					$or: [{ _id: document }, { _id: { $regex: `^${document}:` } }],
				},
				{ projection: { _id: 1, name: 1, type: 1, label: 1, document: 1 } },
			).toArray();

			if (metas.length === 0) {
				return reply.status(404).send({ success: false, errors: ['Document not found'] });
			}

			return reply.send({ success: true, data: metas });
		} catch (error) {
			logger.error(error, `Error listing metas for ${req.params.document}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.get<{ Params: { document: string; type: string; name: string } }>('/:document/:type/:name', async (req, reply) => {
		try {
			const { document, type, name } = req.params;

			if (!META_TYPES.includes(type as any)) {
				return reply.status(400).send({ success: false, errors: [`Invalid type: ${type}`] });
			}

			const metaId = buildMetaId(document, type, name);
			const meta = await MetaObject.MetaObject.findOne({ _id: metaId });

			if (meta == null) {
				return reply.status(404).send({ success: false, errors: ['Meta not found'] });
			}

			return reply.send({ success: true, data: meta });
		} catch (error) {
			logger.error(error, `Error getting meta ${req.params.document}/${req.params.type}/${req.params.name}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.get<{ Params: { document: string; hookName: string } }>('/:document/hook/:hookName', async (req, reply) => {
		try {
			const { document, hookName } = req.params;

			if (!isValidHookName(hookName)) {
				return reply.status(400).send({ success: false, errors: [`Invalid hook name: ${hookName}. Valid: ${HOOK_FIELDS.join(', ')}`] });
			}

			const docMeta = await MetaObject.MetaObject.findOne({ _id: document, type: { $in: ['document', 'composite'] } }, { projection: { [hookName]: 1 } });

			if (docMeta == null) {
				return reply.status(404).send({ success: false, errors: ['Document not found'] });
			}

			const hookValue = (docMeta as any)[hookName];

			if (hookValue == null) {
				return reply.status(404).send({ success: false, errors: [`Hook ${hookName} not defined on ${document}`] });
			}

			return reply.send({ success: true, data: { hookName, value: hookValue } });
		} catch (error) {
			logger.error(error, `Error getting hook ${req.params.hookName} for ${req.params.document}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.put<{ Params: { document: string; type: string; name: string }; Body: Record<string, unknown> }>(
		'/:document/:type/:name',
		async (req, reply) => {
			try {
				const { document, type, name } = req.params;

				if (!META_TYPES.includes(type as any)) {
					return reply.status(400).send({ success: false, errors: [`Invalid type: ${type}`] });
				}

				const body = req.body;
				if (body == null || typeof body !== 'object') {
					return reply.status(400).send({ success: false, errors: ['Body is required'] });
				}

				const metaId = buildMetaId(document, type, name);

				const metaDocument = {
					...body,
					_id: metaId,
					type,
					name,
					...(type !== 'document' && type !== 'composite' && type !== 'namespace' ? { document } : {}),
				};

				const result = await MetaObject.MetaObject.replaceOne({ _id: metaId }, metaDocument as any, { upsert: true });

				const action = result.upsertedCount === 1 ? 'created' : 'updated';
				return reply.status(result.upsertedCount === 1 ? 201 : 200).send({ success: true, action, _id: metaId });
			} catch (error) {
				logger.error(error, `Error upserting meta ${req.params.document}/${req.params.type}/${req.params.name}`);
				return reply.status(500).send({ success: false, errors: ['Internal server error'] });
			}
		},
	);

	fastify.delete<{ Params: { document: string; type: string; name: string } }>('/:document/:type/:name', async (req, reply) => {
		try {
			const { document, type, name } = req.params;

			if (!META_TYPES.includes(type as any)) {
				return reply.status(400).send({ success: false, errors: [`Invalid type: ${type}`] });
			}

			const metaId = buildMetaId(document, type, name);
			const result = await MetaObject.MetaObject.deleteOne({ _id: metaId });

			if (result.deletedCount === 0) {
				return reply.status(404).send({ success: false, errors: ['Meta not found'] });
			}

			return reply.send({ success: true, action: 'deleted', _id: metaId });
		} catch (error) {
			logger.error(error, `Error deleting meta ${req.params.document}/${req.params.type}/${req.params.name}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.put<{ Params: { document: string; hookName: string }; Body: { code?: string; value?: unknown } }>(
		'/:document/hook/:hookName',
		async (req, reply) => {
			try {
				const { document, hookName } = req.params;

				if (!isValidHookName(hookName)) {
					return reply.status(400).send({ success: false, errors: [`Invalid hook name: ${hookName}. Valid: ${HOOK_FIELDS.join(', ')}`] });
				}

				const body = req.body;
				const hookValue = hookName === 'validationData' ? body?.value ?? body : body?.code ?? body;

				if (hookValue == null) {
					return reply.status(400).send({ success: false, errors: ['Hook value is required (code for JS hooks, value for validationData)'] });
				}

				const result = await MetaObject.MetaObject.updateOne(
					{ _id: document, type: { $in: ['document', 'composite'] } },
					{ $set: { [hookName]: hookValue } },
				);

				if (result.matchedCount === 0) {
					return reply.status(404).send({ success: false, errors: ['Document not found'] });
				}

				return reply.send({ success: true, action: 'updated', hookName });
			} catch (error) {
				logger.error(error, `Error updating hook ${req.params.hookName} for ${req.params.document}`);
				return reply.status(500).send({ success: false, errors: ['Internal server error'] });
			}
		},
	);

	fastify.delete<{ Params: { document: string; hookName: string } }>('/:document/hook/:hookName', async (req, reply) => {
		try {
			const { document, hookName } = req.params;

			if (!isValidHookName(hookName)) {
				return reply.status(400).send({ success: false, errors: [`Invalid hook name: ${hookName}. Valid: ${HOOK_FIELDS.join(', ')}`] });
			}

			const result = await MetaObject.MetaObject.updateOne(
				{ _id: document, type: { $in: ['document', 'composite'] } },
				{ $unset: { [hookName]: '' } },
			);

			if (result.matchedCount === 0) {
				return reply.status(404).send({ success: false, errors: ['Document not found'] });
			}

			return reply.send({ success: true, action: 'deleted', hookName });
		} catch (error) {
			logger.error(error, `Error deleting hook ${req.params.hookName} for ${req.params.document}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.post('/reload', async (_req, reply) => {
		try {
			await loadMetaObjects();
			return reply.send({ success: true, action: 'reloaded' });
		} catch (error) {
			logger.error(error, 'Error reloading meta objects');
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});
};

export default fp(metaAdminApi);
