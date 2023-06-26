import get from 'lodash/get';
import set from 'lodash/set';

import { MetaObject } from '/imports/types/metadata';
import { MetaObjectCollection } from '/imports/model/MetaObject';
import { User } from '/imports/model/User';
import { getAccessFor, getFieldPermissions } from '/imports/utils/accessUtils';
import { MetaAccess } from '/imports/model/MetaAccess';

export const buildI18N = async (user: User): Promise<Record<string, unknown>> => {
	const metas: MetaObject[] = await MetaObjectCollection.find<MetaObject>(
		{},
		{
			projection: {
				_id: true,
				type: true,
				name: true,
				document: true,
				label: true,
				plurals: true,
				fields: true,
				columns: true,
				rows: true,
				values: true,
			},
		},
	).toArray();

	const fixISO = (lang: string) => (lang ?? 'en').replace('_', '-');

	return metas.reduce((acc: Record<string, unknown>, meta: MetaObject) => {
		const keyPath = ['group', 'document', 'composite'].includes(meta.type) ? [meta.name] : ([get(meta, 'document'), meta.type, meta.name] as string[]);
		const document = ['document', 'composite'].includes(meta.type) ? meta.name : get(meta, 'document');

		if (meta.type !== 'group' && document == null) {
			return acc;
		}

		const access = getAccessFor(document as string, user);

		if (meta.type !== 'group' && access === false) {
			return acc;
		}

		if (meta.label != null) {
			Object.entries(meta.label).forEach(([lang, label]) => set(acc, [lang, ...keyPath, 'label'], label));
		}
		if (meta.type !== 'composite' && meta.plurals != null) {
			Object.entries(meta.plurals).forEach(([lang, label]) => set(acc, [lang, ...keyPath, 'plural'], label));
		}

		const hasAccess = (fieldName: string) => {
			if (meta.type === 'group') {
				return true;
			}
			const fieldAccess = getFieldPermissions(access as MetaAccess, fieldName);
			return [fieldAccess.isReadable, fieldAccess.isUpdatable, fieldAccess.isCreatable].some(p => p === true);
		};

		['fields', 'columns', 'rows', 'values'].forEach(metaProp => {
			const entry = get(meta, metaProp);
			if (entry != null) {
				if (Array.isArray(entry)) {
					entry.forEach(field => {
						if (field.label != null && hasAccess(field.name)) {
							Object.entries(field.label).forEach(([lang, label]) => set(acc, [fixISO(lang), ...keyPath, metaProp, field.name], label as string));
						}
					});
				} else {
					Object.entries(entry).forEach(([field, fieldLabel]) => {
						const label = get(fieldLabel, 'label');
						if (label != null && hasAccess(field)) {
							Object.entries(label).forEach(([lang, value]) => set(acc, [fixISO(lang), ...keyPath, metaProp, field], value as string));
						}
					});
				}
			}
		});

		return acc;
	}, {});
};
