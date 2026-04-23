import { createIntl, createIntlCache } from 'react-intl';
import enUS from './i18n/en-US.json';
import ptBR from './i18n/pt-BR.json';

const cache = createIntlCache();

const messages = {
	'pt-BR': ptBR,
	'en-US': enUS,
};

export function getIntl() {
	const lang = document.documentElement.lang === 'en-US' ? 'en-US' : 'pt-BR';

	return createIntl(
		{
			locale: lang,
			defaultLocale: 'pt-BR',
			messages: messages[lang],
		},
		cache,
	);
}
