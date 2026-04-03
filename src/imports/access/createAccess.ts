import { getUserSafe } from '@imports/auth/getUser';
import { MetaAccess, MetaAccessSchema } from '@imports/model/MetaAccess';
import { MetaObject } from '@imports/model/MetaObject';
import { KonectyResult } from '@imports/types/result';
import { checkMetaOperation } from '@imports/utils/accessUtils';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Span } from '@opentelemetry/api';
import find from 'lodash/find';

type CreateAccessParams = {
	document: string;
	data: MetaAccess;
	authTokenId: string;
	tracingSpan?: Span;
};

export default async function createAccess({ document, data, authTokenId, tracingSpan }: CreateAccessParams): Promise<KonectyResult<MetaAccess>> {
	tracingSpan?.setAttribute('document', document);
	tracingSpan?.addEvent('Get User', { authTokenId });

	const userResponse = await getUserSafe(authTokenId);
	if (userResponse.success === false) {
		return errorReturn(userResponse.errors);
	}

	const user = userResponse.data;

	if (user.admin !== true) {
		tracingSpan?.setAttribute('error', 'Admin access required');
		return errorReturn('Admin access required');
	}

	tracingSpan?.addEvent('Validate access data');

	const parseResponse = MetaAccessSchema.safeParse(data);
	if (parseResponse.success === false) {
		const errors = parseResponse.error.flatten();
		const errorMessages = Object.values(errors.fieldErrors).concat(errors.formErrors).flat();
		tracingSpan?.setAttribute('error', errorMessages.join(', '));

		return errorReturn(errorMessages);
	}

	const accessId = `${document}:access:${data.name}`;
	const existingAccess = find(MetaObject.Access, { _id: accessId });
	if (existingAccess) {
		tracingSpan?.setAttribute('error', 'Access already exists');
		return errorReturn(`[${document}] Access ${data.name} already exists`);
	}

	const accessToCreate = {
		...parseResponse.data,
		_id: accessId,
		document,
		type: 'access' as const,
	};

	tracingSpan?.addEvent('Create Access');
	const result = await MetaObject.MetaObject.insertOne(accessToCreate);

	if (!result.acknowledged) {
		return errorReturn('Failed to create access');
	}

	MetaObject.Access[accessId] = accessToCreate;

	return successReturn(accessToCreate);
}
