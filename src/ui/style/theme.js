import { red } from '@mui/material/colors';
import { createTheme } from '@mui/material/styles';

export default mode =>
	createTheme({
		palette: {
			mode,
			primary: {
				main: '#556cd6',
			},
			secondary: {
				main: '#19857b',
			},
			error: {
				main: red.A400,
			},
		},
	});
