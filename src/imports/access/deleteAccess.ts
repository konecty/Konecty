import { getUserSafe } from '@imports/auth/getUser';
import { MetaObject } from '@imports/model/MetaObject';
import { KonectyResult } from '@imports/types/result';
import { checkMetaOperation } from '@imports/utils/accessUtils';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Span } from '@opentelemetry/api';
import find from 'lodash/find';

type DeleteAccessParams = {
	document: string;
	accessName: string;
	authTokenId: string;
	tracingSpan?: Span;
};

export default async function deleteAccess({ document, accessName, authTokenId, tracingSpan }: DeleteAccessParams): Promise<KonectyResult<{ success: boolean }>> {
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

	const accessId = `${document}:access:${accessName}`;
	const access = find(MetaObject.Access, { _id: accessId });
	if (!access) {
		tracingSpan?.setAttribute('error', 'Access not found');
		return errorReturn(`[${document}] Access not found`);
	}

	tracingSpan?.addEvent('Delete Access');
	const result = await MetaObject.MetaObject.deleteOne({ _id: accessId });

	if (result.deletedCount === 0) {
		return errorReturn('Failed to delete access');
	}

	delete MetaObject.Access[accessId];

	return successReturn({ success: true });
}
