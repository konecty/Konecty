import get from 'lodash/get';
import set from 'lodash/set';

import { Label } from '@imports/model/Label';
import { MetaObject } from '../../model/MetaObject';
import { User } from '../../model/User';
import { MetaObjectType } from '../../types/metadata';
import { getAccessFor } from '../../utils/accessUtils';
const negative: Label = {
	en: 'Not',
	de: 'Nicht',
	es: 'No',
	fr: 'Pas',
	it: 'Non',
	ja: 'いいえ',
	nl: 'Niet',
	pt: 'Não',
	'pt-BR': 'Não',
	ru: 'нет',
	zh: '不',
};
export const buildI18N = async (user: User): Promise<Record<string, unknown>> => {
	const metas: MetaObjectType[] = await MetaObject.MetaObject.find<MetaObjectType>(
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

	return metas.reduce((acc: Record<string, unknown>, meta: MetaObjectType) => {
		const keyPath = ['group', 'document', 'composite'].includes(meta.type) ? [meta.name] : ([get(meta, 'document'), meta.type, meta.name] as string[]);
		const document = ['document', 'composite'].includes(meta.type) ? meta.name : get(meta, 'document');

		if (meta.type !== 'group' && document == null) {
			return acc;
		}

		const access = getAccessFor(document as string, user);

		if (meta.type !== 'group' && access === false) {
			return acc;
		}

		const label = get(meta, 'label');
		const plurals = get(meta, 'plurals');

		if (label != null) {
			Object.entries(label).forEach(([lang, label]) => set(acc, [fixISO(lang), ...keyPath, 'label'], label));
		}
		if (meta.type !== 'composite' && plurals != null) {
			Object.entries(plurals).forEach(([lang, label]) => set(acc, [fixISO(lang), ...keyPath, 'plural'], label));
		}

		['fields', 'columns', 'rows', 'values'].forEach(metaProp => {
			const entry = get(meta, metaProp);
			if (entry != null) {
				if (Array.isArray(entry)) {
					entry.forEach(field => {
						if (field.label != null) {
							Object.entries(field.label).forEach(([lang, label]) => set(acc, [fixISO(lang), ...keyPath, metaProp, field.name], label as string));
						}
					});
				} else {
					Object.entries(entry).forEach(([field, fieldLabel]) => {
						const label = get(fieldLabel, 'label');
						const options = get(fieldLabel, 'options');
						const type = get(fieldLabel, 'type');
						if (metaProp === 'fields' && options != null) {
							Object.entries(options).forEach(entry => {
								const [option, optionLabels] = entry as [string, Label];
								Object.entries(optionLabels).forEach(([lang, value]) => set(acc, [fixISO(lang), ...keyPath, 'options', field, option], value as string));
							});
						}
						if (label != null) {
							Object.entries(label).forEach(([lang, value]) => {
								set(acc, [fixISO(lang), ...keyPath, metaProp, field], value as string);
								if (metaProp === 'fields' && type === 'boolean') {
									const boolLabels = {
										true: value as string,
										false: get(fieldLabel, 'labelOpposite', `${negative[lang] ?? 'not'} ${value}`),
									};
									set(acc, [fixISO(lang), ...keyPath, 'options', field], boolLabels);
								}
							});
						}
					});
				}
			}
		});

		return acc;
	}, {});
};
