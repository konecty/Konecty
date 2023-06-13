/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { MetaObject } from '../../types/metadata';

import { MetaObjectCollection } from '../../model/MetaObject';

const buildI18N = async (): Promise<Record<string, any>> => {
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
		}},
	).toArray();

	const setKey = (acc: Record<string, any>, lang: string, path: string | string[], label: string) => {
		const isoLang = fixISO(lang);
		if (acc[isoLang] == null) {
			acc[isoLang] = {};
		}
		if (Array.isArray(path)) {
			const deepSet = (obj: Record<string, any>, [key, ...keys]: string[], valor: string): any => {
				if (keys.length == null || keys.length === 0) {
					obj[key] = valor;
					return obj;
				}

				if (obj[key] == null || typeof obj[key] !== 'object') {
					obj[key] = {};
				}

				return deepSet(obj[key], keys, valor);
			};

			deepSet(acc[fixISO(isoLang)], path, label);
		} else {
			acc[fixISO(isoLang)][path] = label;
		}
	};

	const fixISO = (lang: string) => (lang ?? 'en').replace('_', '-');

	return metas.reduce((acc: Record<string, any>, meta: MetaObject) => {
		const keyPath = meta.type === 'document' || meta.type === 'composite' ? [meta.name] : [meta.document, meta.type, meta.name];

		if (meta.label != null) {
			Object.entries(meta.label).forEach(([lang, label]) => setKey(acc, lang, keyPath.concat('label'), label));
		}
		if (meta.type !== 'composite' && meta.plurals != null) {
			Object.entries(meta.plurals).forEach(([lang, label]) => setKey(acc, lang, keyPath.concat('plural'), label));
		}

		['fields', 'columns', 'rows', 'values'].forEach(metaProp => {
			// @ts-ignore
			if (meta[metaProp] != null) {
				// @ts-ignore
				if (Array.isArray(meta[metaProp])) {
					// @ts-ignore
					meta[metaProp].forEach(field => {
						if (field.label != null) {
							// @ts-ignore
							Object.entries(field.label).forEach(([lang, label]) => setKey(acc, lang, keyPath.concat(metaProp, field.name, 'label'), label));
						}
					});
				} else {
					// @ts-ignore
					Object.entries(meta[metaProp]).forEach(([field, fieldLabel]) => {
						// @ts-ignore
						if (fieldLabel.label != null) {
							// @ts-ignore
							Object.entries(fieldLabel.label).forEach(([lang, label]) => setKey(acc, lang, keyPath.concat(metaProp, field, 'label'), label));
						}
					});
				}
			}
		});

		return acc;
	}, {});
};

export default buildI18N;
