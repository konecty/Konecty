import React, { Suspense, useMemo } from 'react';
import ReactDOM from 'react-dom';
import CssBaseline from '@material-ui/core/CssBaseline';
import { ThemeProvider } from '@material-ui/core/styles';
import { useMediaQuery } from '@material-ui/core';
import i18n from 'i18next';
import { useTranslation, initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import Router from 'ui/Router';

import createTheme from 'ui/style/theme';

i18n
	.use(initReactI18next)
	.use(LanguageDetector)
	.init({
		resources: {
			// eslint-disable-next-line global-require
			en: require('../i18n/en.json'),
			// eslint-disable-next-line global-require
			'pt-BR': require('../i18n/pt-BR.json'),
		},
		fallbackLng: 'en',
		debug: true,
		interpolation: {
			escapeValue: false,
		},
	});

const App = () => {
	const { t } = useTranslation();
	const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
	const theme = useMemo(() => createTheme(prefersDarkMode ? 'dark' : 'light'), [prefersDarkMode]);
	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Suspense fallback={<span>{t('Loading...')}</span>}>
				<Router />
			</Suspense>
		</ThemeProvider>
	);
};

ReactDOM.render(
	<Suspense fallback={null}>
		<App />
	</Suspense>,
	document.getElementById('main'),
);
