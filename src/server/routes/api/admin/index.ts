import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { getUserSafe } from '@imports/auth/getUser';
import { MetaAccess } from '@imports/model/MetaAccess';
import { MetaObject } from '@imports/model/MetaObject';
import { KonectyResult } from '@imports/types/result';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Span } from '@opentelemetry/api';
import filter from 'lodash/filter';
import groupBy from 'lodash/groupBy';
import { db } from '@imports/database';
import { ObjectId } from 'mongodb';

import metaAdminApi from './meta';

type AccessProfileSummary = {
	_id: string;
	name: string;
	label: { en: string; pt_BR: string };
	isReadable?: boolean;
	isCreatable?: boolean;
	isUpdatable?: boolean;
	isDeletable?: boolean;
};

type AccessOverviewResponse = {
	documents: Array<{
		_id: string;
		name: string;
		label: { en: string; pt_BR: string };
		type: string;
		accessProfiles: AccessProfileSummary[];
	}>;
	defaultAccessProfiles: AccessProfileSummary[];
	roles: Array<{
		_id: string;
		name: string;
		admin?: boolean;
		access: Record<string, string | string[] | boolean>;
	}>;
};

async function getAccessOverview(authTokenId: string, tracingSpan?: Span): Promise<KonectyResult<AccessOverviewResponse>> {
	tracingSpan?.addEvent('Get User', { authTokenId });

	const userResponse = await getUserSafe(authTokenId);
	if (userResponse.success === false) {
		return errorReturn(userResponse.errors);
	}

	const user = userResponse.data;
	if (user.admin !== true) {
		return errorReturn('Admin access required');
	}

	tracingSpan?.addEvent('Fetch documents and access profiles');

	const documents = await MetaObject.MetaObject.find({ type: 'document' }).toArray();

	const accessProfiles = filter(MetaObject.Access, (access) => access.type === 'access');
	const accessByDocument = groupBy(accessProfiles, 'document');

	const documentList = documents.map((doc) => {
		const docName = doc.name as string;
		const docAccessProfiles = (accessByDocument[docName] || []) as MetaAccess[];
		
		return {
			_id: doc._id,
			name: docName,
			label: doc.label || { en: docName, pt_BR: docName },
			type: doc.type,
			accessProfiles: docAccessProfiles.map((access: MetaAccess) => {
				const accessWithLabel = access as MetaAccess & { label?: { en: string; pt_BR: string } };
				return {
					_id: access._id,
					name: access.name,
					label: accessWithLabel.label ?? { en: access.name, pt_BR: access.name },
					isReadable: access.isReadable,
					isCreatable: access.isCreatable,
					isUpdatable: access.isUpdatable,
					isDeletable: access.isDeletable,
				};
			}),
		};
	});

	const defaultAccessProfilesList = (accessByDocument['Default'] || []) as MetaAccess[];
	const defaultAccessProfiles = defaultAccessProfilesList.map((access: MetaAccess) => {
		const accessWithLabel = access as MetaAccess & { label?: { en: string; pt_BR: string } };
		return {
			_id: access._id,
			name: access.name,
			label: accessWithLabel.label ?? { en: access.name, pt_BR: access.name },
			isReadable: access.isReadable,
			isCreatable: access.isCreatable,
			isUpdatable: access.isUpdatable,
			isDeletable: access.isDeletable,
		};
	});

	tracingSpan?.addEvent('Fetch roles');
	const roles = await db
		.collection('data.Role')
		.find({})
		.project({ _id: 1, name: 1, admin: 1, access: 1 })
		.toArray();

	return successReturn({
		documents: documentList,
		defaultAccessProfiles,
		roles: roles.map((role) => ({
			_id: role._id.toString(),
			name: role.name,
			admin: role.admin,
			access: role.access || {},
		})),
	});
}

async function updateRoleAccess(roleId: string, access: Record<string, string | string[] | boolean>, authTokenId: string, tracingSpan?: Span): Promise<KonectyResult<{ success: boolean }>> {
	tracingSpan?.setAttribute('roleId', roleId);
	tracingSpan?.addEvent('Get User', { authTokenId });

	const userResponse = await getUserSafe(authTokenId);
	if (userResponse.success === false) {
		return errorReturn(userResponse.errors);
	}

	const user = userResponse.data;
	if (user.admin !== true) {
		return errorReturn('Admin access required');
	}

	tracingSpan?.addEvent('Update role access');

	const result = await db.collection('data.Role').updateOne({ _id: new ObjectId(roleId) }, { $set: { access } });

	if (result.matchedCount === 0) {
		return errorReturn('Role not found');
	}

	return successReturn({ success: true });
}

const adminApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.register(metaAdminApi, { prefix: '/api/admin/meta' });

	fastify.get('/api/admin/access-overview', async function (req, reply) {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('GET access-overview');

		const result = await getAccessOverview(getAuthTokenIdFromReq(req) ?? 'no-token', tracingSpan);

		tracingSpan.end();
		reply.send(result);
	});

	fastify.put<{ Params: { roleId: string }; Body: { access: Record<string, string | string[] | boolean> } }>('/api/admin/role/:roleId/access', async function (req, reply) {
		const { tracer } = req.openTelemetry();
		const tracingSpan = tracer.startSpan('PUT role-access');

		const result = await updateRoleAccess(req.params.roleId, req.body.access, getAuthTokenIdFromReq(req) ?? 'no-token', tracingSpan);

		tracingSpan.end();
		reply.send(result);
	});

	done();
};

export default fp(adminApi);
