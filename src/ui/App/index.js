import React, { Suspense, useMemo } from 'react';
import ReactDOM from 'react-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/system';
import useMediaQuery from '@mui/material/useMediaQuery';
import i18n from 'i18next';
import { useTranslation, initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import merge from 'lodash/merge';

import Router from 'ui/Router';

import createTheme from 'ui/style/theme';

import en from 'ui/i18n/en.json';
import ptBR from 'ui/i18n/pt-BR.json';
import icons from 'ui/i18n/icons.json';

i18n
	.use(initReactI18next)
	.use(LanguageDetector)
	.init({
		resources: {
			en: merge(icons, en),
			'pt-BR': merge(icons, ptBR),
		},
		fallbackLng: 'en',
		debug: false,
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
