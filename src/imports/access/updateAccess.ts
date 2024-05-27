import { getUserSafe } from '@imports/auth/getUser';
import { Condition } from '@imports/model/Filter';
import { MetaAccess, MetaAccessSchema } from '@imports/model/MetaAccess';
import { MetaObject } from '@imports/model/MetaObject';
import { KonectyResult } from '@imports/types/result';
import { checkMetaOperation } from '@imports/utils/accessUtils';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Span } from '@opentelemetry/api';
import find from 'lodash/find';
import { UpdateFilter } from 'mongodb';
import { z } from 'zod';

const AccessUpdateSchema = z.union([
	z.object({
		fields: z
			.object({
				fieldNames: z.array(z.string()),
				allow: z.boolean(),
				condition: Condition.optional(),
			})
			.array(),
	}),
	MetaAccessSchema.pick({ readFilter: true }).required(),
	MetaAccessSchema.pick({ updateFilter: true }).required(),
]);
export type AccessUpdate = z.infer<typeof AccessUpdateSchema>;

type UpdateAccessParams = {
	document: string;
	accessName: string;

	data: AccessUpdate;
	authTokenId: string;

	tracingSpan?: Span;
};

export default async function updateAccess({ document, accessName, data, authTokenId, tracingSpan }: UpdateAccessParams): Promise<KonectyResult<MetaAccess>> {
	tracingSpan?.setAttribute('document', document);
	tracingSpan?.addEvent('Get User', { authTokenId });

	const userResponse = await getUserSafe(authTokenId);
	if (userResponse.success === false) {
		return errorReturn(userResponse.errors);
	}

	const user = userResponse.data;

	tracingSpan?.addEvent('Check Meta Operation');

	const metaOperationAccess = checkMetaOperation({ user, operation: 'updateAccess', document });
	if (metaOperationAccess === false) {
		tracingSpan?.setAttribute('error', "You don't have permission to update access");
		return errorReturn(`[${document}] You don't have permission to update access`);
	}

	tracingSpan?.addEvent('Find Access', { accessName });
	const access = find(MetaObject.Access, { document, name: accessName });
	if (!access) {
		tracingSpan?.setAttribute('error', 'Access not found');
		return errorReturn(`[${document}] Access not found`);
	}

	tracingSpan?.addEvent('Parse update schema');
	const parseResponse = AccessUpdateSchema.safeParse(data);
	if (parseResponse.success === false) {
		const errors = parseResponse.error.flatten();
		const errorMessages = Object.values(errors.fieldErrors).concat(errors.formErrors).flat();
		tracingSpan?.setAttribute('error', errorMessages.join(', '));

		return errorReturn(errorMessages);
	}

	const updateObj: Required<Pick<UpdateFilter<MetaAccess>, '$set'>> = { $set: {} };

	if ('fields' in data) {
		for (const { fieldNames, allow, condition } of data.fields) {
			for (const fieldName of fieldNames) {
				updateObj.$set[`fields.${fieldName}`] = { allow, condition };
			}
		}
	}

	if ('readFilter' in data) {
		updateObj.$set = { ...updateObj.$set, readFilter: data.readFilter };
	}

	if ('updateFilter' in data) {
		updateObj.$set = { ...updateObj.$set, updateFilter: data.updateFilter };
	}

	if (Object.keys(updateObj.$set).length === 0) {
		tracingSpan?.setAttribute('error', 'Nothing changed');
		return errorReturn('Nothing changed');
	}

	tracingSpan?.addEvent('Update Access');
	const result = await MetaObject.MetaObject.findOneAndUpdate({ _id: access._id }, updateObj, { returnDocument: 'after', ignoreUndefined: true });
	return successReturn(result);
}
