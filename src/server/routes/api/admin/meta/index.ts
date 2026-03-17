import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { Script } from 'node:vm';

import { getUserFromRequest } from '@imports/auth/getUser';
import { db } from '@imports/database';
import { loadMetaObjects } from '@imports/meta/loadMetaObjects';
import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectSchema } from '@imports/types/metadata';
import { logger } from '@imports/utils/logger';

const HOOK_FIELDS = ['scriptBeforeValidation', 'validationScript', 'scriptAfterSave', 'validationData'] as const;

const META_TYPES = ['document', 'composite', 'list', 'view', 'access', 'pivot', 'card', 'namespace'] as const;
const PRIMARY_META_TYPES = ['document', 'composite'] as const;

type HookName = (typeof HOOK_FIELDS)[number];
type MetaType = (typeof META_TYPES)[number];
type HistoryOperation = 'update' | 'delete' | 'rollback';
type AdminUserLike = { _id?: unknown };

type DoctorIssue = {
	metaId: string;
	severity: 'error' | 'warning';
	message: string;
};

const META_HISTORY_COLLECTION = 'MetaObjects.History';
const DEFAULT_HISTORY_LIMIT = 10;
const MAX_HISTORY_LIMIT = 100;
const HOOKS_WITH_MANDATORY_RETURN: HookName[] = ['scriptBeforeValidation', 'validationScript'];

const BLOCKED_HOOK_PATTERNS: Array<{ regex: RegExp; message: string }> = [
	{ regex: /\brequire\s*\(/u, message: 'Usage of require() is not allowed in hooks' },
	{ regex: /\bimport\s+[\w*{]/u, message: 'ES import statements are not allowed in hooks' },
	{ regex: /\bimport\s*\(/u, message: 'Dynamic import() is not allowed in hooks' },
	{ regex: /\bprocess\b/u, message: 'Usage of process is not allowed in hooks' },
	{ regex: /\bglobalThis\b/u, message: 'Usage of globalThis is not allowed in hooks' },
	{ regex: /\bglobal\b/u, message: 'Usage of global is not allowed in hooks' },
	{ regex: /\beval\s*\(/u, message: 'Usage of eval() is not allowed in hooks' },
	{ regex: /\bFunction\s*\(/u, message: 'Usage of Function() is not allowed in hooks' },
	{ regex: /\bnew\s+Function\b/u, message: 'Usage of new Function() is not allowed in hooks' },
	{ regex: /\bchild_process\b/u, message: 'Access to child_process is not allowed in hooks' },
	{ regex: /\bfs\b/u, message: 'Access to fs is not allowed in hooks' },
	{ regex: /\bnet\b/u, message: 'Access to net is not allowed in hooks' },
	{ regex: /\bdgram\b/u, message: 'Access to dgram is not allowed in hooks' },
];

function isValidHookName(name: string): name is HookName {
	return HOOK_FIELDS.includes(name as HookName);
}

function isValidMetaType(type: string): type is MetaType {
	return META_TYPES.includes(type as MetaType);
}

function buildMetaId(document: string, type: string, name: string): string {
	if (PRIMARY_META_TYPES.includes(type as (typeof PRIMARY_META_TYPES)[number])) {
		return document;
	}
	return `${document}:${type}:${name}`;
}

function getAdminUser(req: FastifyRequest): AdminUserLike | undefined {
	return (req as FastifyRequest & { adminUser?: AdminUserLike }).adminUser;
}

function formatZodErrors(result: ReturnType<typeof MetaObjectSchema.safeParse>) {
	if (result.success) {
		return [];
	}
	return result.error.issues.map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
}

function containsComments(script: string): boolean {
	let inSingle = false;
	let inDouble = false;
	let inTemplate = false;
	let escaped = false;

	for (let i = 0; i < script.length; i += 1) {
		const current = script[i];
		const next = script[i + 1];

		if (escaped) {
			escaped = false;
			continue;
		}

		if (inSingle) {
			if (current === '\\') {
				escaped = true;
				continue;
			}
			if (current === "'") {
				inSingle = false;
			}
			continue;
		}

		if (inDouble) {
			if (current === '\\') {
				escaped = true;
				continue;
			}
			if (current === '"') {
				inDouble = false;
			}
			continue;
		}

		if (inTemplate) {
			if (current === '\\') {
				escaped = true;
				continue;
			}
			if (current === '`') {
				inTemplate = false;
			}
			continue;
		}

		if (current === "'") {
			inSingle = true;
			continue;
		}
		if (current === '"') {
			inDouble = true;
			continue;
		}
		if (current === '`') {
			inTemplate = true;
			continue;
		}

		if (current === '/' && (next === '/' || next === '*')) {
			return true;
		}
	}

	return false;
}

function buildHookWrapper(hookName: HookName, script: string): string {
	if (hookName === 'scriptBeforeValidation') {
		return `(function(data, emails, user, console){${script}\n})`;
	}
	if (hookName === 'validationScript') {
		return `(function(data, user, console, extraData){${script}\n})`;
	}
	if (hookName === 'scriptAfterSave') {
		return `(async function(data, user, console, Models, extraData){${script}\n})`;
	}
	return '{}';
}

function validateHookScript(hookName: HookName, script: string): string[] {
	const errors: string[] = [];
	const trimmed = script.trim();

	if (trimmed.length === 0) {
		errors.push(`hook ${hookName}: script cannot be empty`);
		return errors;
	}

	if (containsComments(script)) {
		errors.push(`hook ${hookName}: comments are not allowed`);
	}

	for (const blockedPattern of BLOCKED_HOOK_PATTERNS) {
		if (blockedPattern.regex.test(script)) {
			errors.push(`hook ${hookName}: ${blockedPattern.message}`);
		}
	}

	if (HOOKS_WITH_MANDATORY_RETURN.includes(hookName) && !/\breturn\b/u.test(script)) {
		errors.push(`hook ${hookName}: explicit return is required`);
	}

	try {
		new Script(buildHookWrapper(hookName, script));
	} catch (error) {
		errors.push(`hook ${hookName}: invalid JavaScript syntax (${(error as Error).message})`);
	}

	return errors;
}

function validateHookFields(meta: unknown): string[] {
	if (meta == null || typeof meta !== 'object') {
		return [];
	}

	const metaRecord = meta as Record<string, unknown>;
	const errors: string[] = [];

	for (const hookName of HOOK_FIELDS) {
		const value = metaRecord[hookName];
		if (value == null) {
			continue;
		}

		if (hookName === 'validationData') {
			if (typeof value !== 'object' || Array.isArray(value)) {
				errors.push(`hook validationData: value must be an object`);
			}
			continue;
		}

		if (typeof value !== 'string') {
			errors.push(`hook ${hookName}: value must be a string`);
			continue;
		}

		errors.push(...validateHookScript(hookName, value));
	}

	return errors;
}

function resolveHookValueFromBody(hookName: HookName, body: { code?: unknown; value?: unknown } | undefined): unknown {
	if (hookName === 'validationData') {
		return body?.value ?? body;
	}
	return body?.code ?? body;
}

function validateHookPayload(hookName: HookName, hookValue: unknown): string[] {
	if (hookValue == null) {
		return ['Hook value is required (code for JS hooks, value for validationData)'];
	}

	if (hookName === 'validationData') {
		if (typeof hookValue !== 'object' || Array.isArray(hookValue)) {
			return ['validationData must be an object'];
		}
		return validateHookFields({ [hookName]: hookValue });
	}

	if (typeof hookValue !== 'string') {
		return [`${hookName} must be a string`];
	}

	return validateHookFields({ [hookName]: hookValue });
}

function validateMetaPayload(meta: unknown): string[] {
	const parsed = MetaObjectSchema.safeParse(meta);
	return [...formatZodErrors(parsed), ...validateHookFields(meta)];
}

async function saveHistory(metaId: string, adminUser: AdminUserLike | undefined, operation: HistoryOperation) {
	const currentMeta = await MetaObject.MetaObject.findOne({ _id: metaId });
	if (currentMeta == null) {
		return;
	}

	const latest = await db.collection(META_HISTORY_COLLECTION).find({ metaId }).sort({ version: -1 }).limit(1).toArray();
	const nextVersion = (latest[0]?.version ?? 0) + 1;

	await db.collection(META_HISTORY_COLLECTION).insertOne({
		metaId,
		version: nextVersion,
		snapshot: currentMeta,
		operation,
		changedBy: String(adminUser?._id ?? 'unknown'),
		changedAt: new Date(),
	});
}

async function ensureHistoryIndex() {
	await db.collection(META_HISTORY_COLLECTION).createIndex({ metaId: 1, version: -1 }, { name: 'metaId_version_desc' });
}

function getLookupDocumentTargets(meta: Record<string, unknown>): string[] {
	const fields = meta.fields;
	if (fields == null || typeof fields !== 'object') {
		return [];
	}

	const lookupTypes = new Set(['lookup', 'inheritLookup']);
	const targets: string[] = [];
	for (const value of Object.values(fields as Record<string, unknown>)) {
		if (value == null || typeof value !== 'object') {
			continue;
		}
		const field = value as Record<string, unknown>;
		const fieldType = typeof field.type === 'string' ? field.type : '';
		const targetDocument = typeof field.document === 'string' ? field.document : '';
		if (lookupTypes.has(fieldType) && targetDocument.length > 0) {
			targets.push(targetDocument);
		}
	}
	return targets;
}

async function runDoctor(document?: string) {
	const filter =
		document != null
			? {
					$or: [{ _id: document }, { _id: { $regex: `^${document}:` } }],
				}
			: {};

	const metas = await MetaObject.MetaObject.find(filter).toArray();
	const issues: DoctorIssue[] = [];
	const issueKeys = new Set<string>();
	const addIssue = (issue: DoctorIssue) => {
		const key = `${issue.metaId}|${issue.severity}|${issue.message}`;
		if (issueKeys.has(key)) {
			return;
		}
		issueKeys.add(key);
		issues.push(issue);
	};

	const allDocuments = await MetaObject.MetaObject.find({ type: { $in: ['document', 'composite'] } }, { projection: { _id: 1, fields: 1 } }).toArray();
	const knownDocuments = new Set(allDocuments.map(meta => String(meta._id)));
	const documentByName = new Map(allDocuments.map(meta => [String(meta._id), meta]));

	const namespaceMeta = metas.find(meta => meta.type === 'namespace') ?? (await MetaObject.MetaObject.findOne({ type: 'namespace' }));
	const queueResources = new Set(
		Object.keys(
			(((namespaceMeta as Record<string, unknown> | undefined)?.QueueConfig as Record<string, unknown> | undefined)?.resources as Record<string, unknown> | undefined) ?? {},
		),
	);

	for (const meta of metas) {
		const metaId = String(meta._id);
		const parsed = MetaObjectSchema.safeParse(meta);
		if (!parsed.success) {
			addIssue({
				metaId,
				severity: 'error',
				message: `Schema validation failed: ${formatZodErrors(parsed).slice(0, 3).join(' | ')}`,
			});
		}

		for (const hookError of validateHookFields(meta)) {
			addIssue({ metaId, severity: 'error', message: hookError });
		}

		if (meta.type === 'document' || meta.type === 'list' || meta.type === 'view') {
			const label = (meta as Record<string, unknown>).label;
			const hasLabel = label != null && typeof label === 'object' && Object.keys(label as Record<string, unknown>).length > 0;
			if (!hasLabel) {
				addIssue({ metaId, severity: 'warning', message: 'Missing or empty label' });
			}
		}

		if (['list', 'view', 'access', 'pivot', 'card'].includes(String(meta.type))) {
			const parentDocument = typeof (meta as Record<string, unknown>).document === 'string' ? String((meta as Record<string, unknown>).document) : '';
			if (parentDocument.length === 0 || !knownDocuments.has(parentDocument)) {
				addIssue({ metaId, severity: 'error', message: `Orphan meta: document "${parentDocument}" does not exist` });
			}
		}

		if (meta.type === 'access') {
			const parentDocument = String((meta as Record<string, unknown>).document ?? '');
			const parentMeta = documentByName.get(parentDocument) as Record<string, unknown> | undefined;
			const parentFields = (parentMeta?.fields as Record<string, unknown> | undefined) ?? {};
			const accessFields = ((meta as Record<string, unknown>).fields as Record<string, unknown> | undefined) ?? {};
			for (const fieldName of Object.keys(accessFields)) {
				if (!(fieldName in parentFields)) {
					addIssue({ metaId, severity: 'warning', message: `Access field override "${fieldName}" does not exist in document "${parentDocument}"` });
				}
			}
		}

		if (meta.type === 'document' || meta.type === 'composite') {
			for (const targetDocument of getLookupDocumentTargets(meta as Record<string, unknown>)) {
				if (!knownDocuments.has(targetDocument)) {
					addIssue({ metaId, severity: 'error', message: `Lookup target document "${targetDocument}" not found` });
				}
			}

			const events = ((meta as Record<string, unknown>).events as unknown[]) ?? [];
			for (const eventItem of events) {
				if (eventItem == null || typeof eventItem !== 'object') {
					continue;
				}
				const event = (eventItem as Record<string, unknown>).event;
				if (event == null || typeof event !== 'object') {
					continue;
				}
				if ((event as Record<string, unknown>).type === 'queue') {
					const resource = String((event as Record<string, unknown>).resource ?? '');
					if (resource.length === 0 || !queueResources.has(resource)) {
						addIssue({ metaId, severity: 'error', message: `Queue resource "${resource}" not found in Namespace.QueueConfig.resources` });
					}
				}
			}
		}
	}

	const errorMetaIds = new Set(issues.filter(issue => issue.severity === 'error').map(issue => issue.metaId));
	const summary = {
		total: metas.length,
		valid: metas.length - errorMetaIds.size,
		warnings: issues.filter(issue => issue.severity === 'warning').length,
		errors: issues.filter(issue => issue.severity === 'error').length,
	};

	return { summary, issues };
}

const metaAdminApi: FastifyPluginCallback = async fastify => {
	await ensureHistoryIndex();

	fastify.addHook('preHandler', async (req, reply) => {
		try {
			const user = await getUserFromRequest(req);
			if (user == null || user.admin !== true) {
				return reply.status(401).send({ success: false, errors: ['Admin access required'] });
			}
			(req as FastifyRequest & { adminUser?: AdminUserLike }).adminUser = user;
		} catch (error) {
			return reply.status(401).send({ success: false, errors: ['Unauthorized'] });
		}
	});

	fastify.get('/', async (_req, reply) => {
		try {
			const documents = await MetaObject.MetaObject.find({ type: { $in: ['document', 'composite'] } }, { projection: { _id: 1, name: 1, type: 1, label: 1 } }).toArray();

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

			if (!isValidMetaType(type)) {
				return reply.status(400).send({ success: false, errors: [`Invalid type: ${type}`] });
			}

			const effectiveName = PRIMARY_META_TYPES.includes(type as (typeof PRIMARY_META_TYPES)[number]) ? document : name;
			const metaId = buildMetaId(document, type, effectiveName);
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

	fastify.get<{ Params: { document: string; type: string } }>('/:document/:type', async (req, reply) => {
		try {
			const { document, type } = req.params;

			if (!PRIMARY_META_TYPES.includes(type as (typeof PRIMARY_META_TYPES)[number])) {
				return reply.status(400).send({ success: false, errors: [`Invalid type for 2-segment route: ${type}. Use document or composite.`] });
			}

			const metaId = buildMetaId(document, type, document);
			const meta = await MetaObject.MetaObject.findOne({ _id: metaId });

			if (meta == null) {
				return reply.status(404).send({ success: false, errors: ['Meta not found'] });
			}

			return reply.send({ success: true, data: meta });
		} catch (error) {
			logger.error(error, `Error getting meta ${req.params.document}/${req.params.type}`);
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

			const hookValue = (docMeta as Record<string, unknown>)[hookName];

			if (hookValue == null) {
				return reply.status(404).send({ success: false, errors: [`Hook ${hookName} not defined on ${document}`] });
			}

			return reply.send({ success: true, data: { hookName, value: hookValue } });
		} catch (error) {
			logger.error(error, `Error getting hook ${req.params.hookName} for ${req.params.document}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.put<{ Params: { document: string; type: string; name: string }; Body: Record<string, unknown> }>('/:document/:type/:name', async (req, reply) => {
		try {
			const { document, type, name } = req.params;

			if (!isValidMetaType(type)) {
				return reply.status(400).send({ success: false, errors: [`Invalid type: ${type}`] });
			}

			const body = req.body;
			if (body == null || typeof body !== 'object') {
				return reply.status(400).send({ success: false, errors: ['Body is required'] });
			}

			const effectiveName = PRIMARY_META_TYPES.includes(type as (typeof PRIMARY_META_TYPES)[number]) ? document : name;
			const metaId = buildMetaId(document, type, effectiveName);

			const metaDocument = {
				...body,
				_id: metaId,
				type,
				name: effectiveName,
				...(type !== 'document' && type !== 'composite' && type !== 'namespace' ? { document } : {}),
			};

			const validationErrors = validateMetaPayload(metaDocument);
			if (validationErrors.length > 0) {
				return reply.status(400).send({ success: false, errors: validationErrors });
			}

			await saveHistory(metaId, getAdminUser(req), 'update');

			const result = await MetaObject.MetaObject.replaceOne({ _id: metaId }, metaDocument as unknown as never, { upsert: true });

			const action = result.upsertedCount === 1 ? 'created' : 'updated';
			return reply.status(result.upsertedCount === 1 ? 201 : 200).send({ success: true, action, _id: metaId });
		} catch (error) {
			logger.error(error, `Error upserting meta ${req.params.document}/${req.params.type}/${req.params.name}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.put<{ Params: { document: string; type: string }; Body: Record<string, unknown> }>('/:document/:type', async (req, reply) => {
		try {
			const { document, type } = req.params;

			if (!PRIMARY_META_TYPES.includes(type as (typeof PRIMARY_META_TYPES)[number])) {
				return reply.status(400).send({ success: false, errors: [`Invalid type for 2-segment route: ${type}. Use document or composite.`] });
			}

			const body = req.body;
			if (body == null || typeof body !== 'object') {
				return reply.status(400).send({ success: false, errors: ['Body is required'] });
			}

			const metaId = buildMetaId(document, type, document);
			const metaDocument = {
				...body,
				_id: metaId,
				type,
				name: document,
			};

			const validationErrors = validateMetaPayload(metaDocument);
			if (validationErrors.length > 0) {
				return reply.status(400).send({ success: false, errors: validationErrors });
			}

			await saveHistory(metaId, getAdminUser(req), 'update');

			const result = await MetaObject.MetaObject.replaceOne({ _id: metaId }, metaDocument as unknown as never, { upsert: true });

			const action = result.upsertedCount === 1 ? 'created' : 'updated';
			return reply.status(result.upsertedCount === 1 ? 201 : 200).send({ success: true, action, _id: metaId });
		} catch (error) {
			logger.error(error, `Error upserting meta ${req.params.document}/${req.params.type}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.delete<{ Params: { document: string; type: string; name: string } }>('/:document/:type/:name', async (req, reply) => {
		try {
			const { document, type, name } = req.params;

			if (!isValidMetaType(type)) {
				return reply.status(400).send({ success: false, errors: [`Invalid type: ${type}`] });
			}

			const effectiveName = PRIMARY_META_TYPES.includes(type as (typeof PRIMARY_META_TYPES)[number]) ? document : name;
			const metaId = buildMetaId(document, type, effectiveName);
			await saveHistory(metaId, getAdminUser(req), 'delete');
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

	fastify.delete<{ Params: { document: string; type: string } }>('/:document/:type', async (req, reply) => {
		try {
			const { document, type } = req.params;

			if (!PRIMARY_META_TYPES.includes(type as (typeof PRIMARY_META_TYPES)[number])) {
				return reply.status(400).send({ success: false, errors: [`Invalid type for 2-segment route: ${type}. Use document or composite.`] });
			}

			const metaId = buildMetaId(document, type, document);
			await saveHistory(metaId, getAdminUser(req), 'delete');
			const result = await MetaObject.MetaObject.deleteOne({ _id: metaId });

			if (result.deletedCount === 0) {
				return reply.status(404).send({ success: false, errors: ['Meta not found'] });
			}

			return reply.send({ success: true, action: 'deleted', _id: metaId });
		} catch (error) {
			logger.error(error, `Error deleting meta ${req.params.document}/${req.params.type}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.post<{ Body: { hookName?: string; code?: unknown; value?: unknown; document?: string } }>('/hook/validate', async (req, reply) => {
		try {
			const { hookName, document } = req.body ?? {};
			if (hookName == null || typeof hookName !== 'string' || !isValidHookName(hookName)) {
				return reply.status(400).send({ success: false, errors: [`Invalid hook name: ${hookName}. Valid: ${HOOK_FIELDS.join(', ')}`] });
			}

			const hookValue = resolveHookValueFromBody(hookName, req.body);
			const hookPayloadErrors = validateHookPayload(hookName, hookValue);
			if (hookPayloadErrors.length > 0) {
				return reply.send({ success: true, valid: false, errors: hookPayloadErrors });
			}

			if (document == null) {
				return reply.send({ success: true, valid: true, errors: [] });
			}

			if (typeof document !== 'string') {
				return reply.status(400).send({ success: false, errors: ['document must be a string when provided'] });
			}

			const currentMeta = await MetaObject.MetaObject.findOne({ _id: document, type: { $in: ['document', 'composite'] } });
			if (currentMeta == null) {
				return reply.status(404).send({ success: false, errors: ['Document not found'] });
			}

			const nextMeta = { ...currentMeta, [hookName]: hookValue };
			const validationErrors = validateMetaPayload(nextMeta);
			return reply.send({ success: true, valid: validationErrors.length === 0, errors: validationErrors });
		} catch (error) {
			logger.error(error, 'Error validating hook payload');
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.put<{ Params: { document: string; hookName: string }; Body: { code?: string; value?: unknown } }>('/:document/hook/:hookName', async (req, reply) => {
		try {
			const { document, hookName } = req.params;

			if (!isValidHookName(hookName)) {
				return reply.status(400).send({ success: false, errors: [`Invalid hook name: ${hookName}. Valid: ${HOOK_FIELDS.join(', ')}`] });
			}

			const hookValue = resolveHookValueFromBody(hookName, req.body);
			const hookPayloadErrors = validateHookPayload(hookName, hookValue);
			if (hookPayloadErrors.length > 0) {
				return reply.status(400).send({ success: false, errors: hookPayloadErrors });
			}

			const currentMeta = await MetaObject.MetaObject.findOne({ _id: document, type: { $in: ['document', 'composite'] } });
			if (currentMeta == null) {
				return reply.status(404).send({ success: false, errors: ['Document not found'] });
			}

			const nextMeta = { ...currentMeta, [hookName]: hookValue };
			const validationErrors = validateMetaPayload(nextMeta);
			if (validationErrors.length > 0) {
				return reply.status(400).send({ success: false, errors: validationErrors });
			}

			await saveHistory(document, getAdminUser(req), 'update');

			const result = await MetaObject.MetaObject.updateOne({ _id: document, type: { $in: ['document', 'composite'] } }, { $set: { [hookName]: hookValue } });

			if (result.matchedCount === 0) {
				return reply.status(404).send({ success: false, errors: ['Document not found'] });
			}

			return reply.send({ success: true, action: 'updated', hookName });
		} catch (error) {
			logger.error(error, `Error updating hook ${req.params.hookName} for ${req.params.document}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.delete<{ Params: { document: string; hookName: string } }>('/:document/hook/:hookName', async (req, reply) => {
		try {
			const { document, hookName } = req.params;

			if (!isValidHookName(hookName)) {
				return reply.status(400).send({ success: false, errors: [`Invalid hook name: ${hookName}. Valid: ${HOOK_FIELDS.join(', ')}`] });
			}

			const currentMeta = await MetaObject.MetaObject.findOne({ _id: document, type: { $in: ['document', 'composite'] } });
			if (currentMeta == null) {
				return reply.status(404).send({ success: false, errors: ['Document not found'] });
			}

			const nextMeta = { ...currentMeta };
			delete (nextMeta as Record<string, unknown>)[hookName];
			const validationErrors = validateMetaPayload(nextMeta);
			if (validationErrors.length > 0) {
				return reply.status(400).send({ success: false, errors: validationErrors });
			}

			await saveHistory(document, getAdminUser(req), 'update');

			const result = await MetaObject.MetaObject.updateOne({ _id: document, type: { $in: ['document', 'composite'] } }, { $unset: { [hookName]: '' } });

			if (result.matchedCount === 0) {
				return reply.status(404).send({ success: false, errors: ['Document not found'] });
			}

			return reply.send({ success: true, action: 'deleted', hookName });
		} catch (error) {
			logger.error(error, `Error deleting hook ${req.params.hookName} for ${req.params.document}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.get<{ Params: { metaId: string }; Querystring: { limit?: string; offset?: string } }>('/:metaId/history', async (req, reply) => {
		try {
			const limitRaw = Number(req.query.limit ?? DEFAULT_HISTORY_LIMIT);
			const offsetRaw = Number(req.query.offset ?? 0);
			const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_HISTORY_LIMIT) : DEFAULT_HISTORY_LIMIT;
			const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

			const history = await db
				.collection(META_HISTORY_COLLECTION)
				.find({ metaId: req.params.metaId }, { projection: { _id: 0, metaId: 0, snapshot: 0 } })
				.sort({ version: -1 })
				.skip(offset)
				.limit(limit)
				.toArray();

			return reply.send({ success: true, data: history, pagination: { limit, offset, count: history.length } });
		} catch (error) {
			logger.error(error, `Error listing history for ${req.params.metaId}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.get<{ Params: { metaId: string; version: string } }>('/:metaId/history/:version', async (req, reply) => {
		try {
			const version = Number(req.params.version);
			if (!Number.isInteger(version) || version <= 0) {
				return reply.status(400).send({ success: false, errors: ['Version must be a positive integer'] });
			}

			const entry = await db.collection(META_HISTORY_COLLECTION).findOne({ metaId: req.params.metaId, version }, { projection: { _id: 0 } });
			if (entry == null) {
				return reply.status(404).send({ success: false, errors: ['History version not found'] });
			}

			return reply.send({ success: true, data: entry });
		} catch (error) {
			logger.error(error, `Error getting history version ${req.params.version} for ${req.params.metaId}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.post<{ Params: { metaId: string }; Body: { version?: number } }>('/:metaId/rollback', async (req, reply) => {
		try {
			const version = req.body?.version;
			if (version != null && (!Number.isInteger(version) || version <= 0)) {
				return reply.status(400).send({ success: false, errors: ['version must be a positive integer'] });
			}

			const historyCollection = db.collection(META_HISTORY_COLLECTION);
			const targetEntry =
				version != null
					? await historyCollection.findOne({ metaId: req.params.metaId, version })
					: await historyCollection.find({ metaId: req.params.metaId }).sort({ version: -1 }).limit(1).next();

			if (targetEntry == null) {
				return reply.status(404).send({ success: false, errors: ['Rollback history not found'] });
			}

			const validationErrors = validateMetaPayload(targetEntry.snapshot);
			if (validationErrors.length > 0) {
				return reply.status(400).send({ success: false, errors: ['Target snapshot is invalid and cannot be restored', ...validationErrors] });
			}

			await saveHistory(req.params.metaId, getAdminUser(req), 'rollback');

			await MetaObject.MetaObject.replaceOne({ _id: req.params.metaId }, targetEntry.snapshot as unknown as never, { upsert: true });
			await loadMetaObjects();

			return reply.send({ success: true, action: 'rolled-back', data: targetEntry.snapshot, version: targetEntry.version });
		} catch (error) {
			logger.error(error, `Error rolling back meta ${req.params.metaId}`);
			return reply.status(500).send({ success: false, errors: ['Internal server error'] });
		}
	});

	fastify.post<{ Body: { document?: string } }>('/doctor', async (req, reply) => {
		try {
			const document = req.body?.document;
			if (document != null && typeof document !== 'string') {
				return reply.status(400).send({ success: false, errors: ['document must be a string when provided'] });
			}

			const report = await runDoctor(document);
			return reply.send({ success: true, ...report });
		} catch (error) {
			logger.error(error, 'Error running meta doctor');
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

// Keep this plugin encapsulated so that the `/api/admin/meta` prefix scopes routes correctly.
// Without encapsulation, relative routes like `GET('/')` may leak to the parent scope and
// collide with UI routes like `GET '/'`.
export default fp(metaAdminApi, { name: 'meta-admin-api', encapsulate: true });
