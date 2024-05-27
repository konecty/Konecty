import { getUserSafe } from '@imports/auth/getUser';
import { MetaAccess } from '@imports/model/MetaAccess';
import { MetaObject } from '@imports/model/MetaObject';
import { KonectyResult } from '@imports/types/result';
import { checkMetaOperation, getAccessFor } from '@imports/utils/accessUtils';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Span } from '@opentelemetry/api';
import filter from 'lodash/filter';

type GetAccessForParams = {
	document: string;
	authTokenId: string;

	tracingSpan?: Span;
};

export default async function getAccessForDocument({ document, authTokenId, tracingSpan }: GetAccessForParams): Promise<KonectyResult<MetaAccess[]>> {
	tracingSpan?.setAttribute('document', document);
	tracingSpan?.addEvent('Get User', { authTokenId });

	const userResponse = await getUserSafe(authTokenId);
	if (userResponse.success === false) {
		return errorReturn(userResponse.errors);
	}

	const user = userResponse.data;
	const access = getAccessFor(document, user);

	if (access === false || access.isReadable !== true) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	tracingSpan?.addEvent('Check Meta Operation');

	const metaOperationAccess = checkMetaOperation({ user, operation: 'readAccess', document });
	if (metaOperationAccess === false) {
		return errorReturn(`[${document}] You don't have permission to read access`);
	}

	tracingSpan?.addEvent('Filter Accesses');
	const documentAccesses = filter(MetaObject.Access, { document });

	return successReturn(documentAccesses);
}
