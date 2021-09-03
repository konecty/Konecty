import i18n from 'i18next';

export default translate => translate[i18n.language] ?? translate[i18n.language.replace(/-/, '_')] ?? Object.keys(translate)[0] ?? 'No Label';
