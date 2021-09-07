import React, { useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import LoadingButton from '@mui/lab/LoadingButton';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useTranslation } from 'react-i18next';
import kebabCase from 'lodash/kebabCase';

import logger from 'utils/logger';
import doLogin from 'ui/DAL/doLogin';
import { SHA256 } from 'utils/sha256';

import { setLogin } from 'ui/store/user';

import Copyright from './Copyright';
import useStyles from './style';

const getGeolocation = () =>
	new Promise(resolve => {
		navigator.geolocation.getCurrentPosition(
			({ coords } = {}) => {
				resolve({ lat: coords?.latitude, lng: coords?.longitude });
			},
			error => {
				logger.error(error, 'Error getting user location');
				resolve({});
			},
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
		);
	});

const Login = () => {
	const classes = useStyles();
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const [errorMessages, setErrorMessages] = useState();

	const validationSchema = useMemo(() =>
		yup.object({
			email: yup.string(t('Enter your email')).email(t('Enter a valid email')).required(t('Email is required')),
			password: yup
				.string(t('Enter your password'))
				.min(8, t('Insecure Password', { min: 8 }))
				.required(t('Password is required')),
		}),
	);

	const formik = useFormik({
		initialValues: {
			email: '',
			password: '',
		},
		validationSchema,
		onSubmit: async ({ email, password }) => {
			setLoading(true);
			const geolocation = await getGeolocation();
			const loginData = {
				user: email,
				password: SHA256(password),
				ns: window.location.hostname,
				geolocation: JSON.stringify(geolocation),
				resolution: JSON.stringify({
					height: window.outerHeight,
					width: window.outerWidth,
				}),
			};
			const loginResult = await doLogin(loginData);

			if (loginResult == null) {
				setErrorMessages([
					`Ops, we have a problem with your login.
					Please check your personal data and internet connection and try again.
					If the problem persists, please contact our support.`,
				]);
			}

			const { success, errors } = loginResult;

			if (success === false) {
				setErrorMessages(errors);
			}

			if (success === true) {
				setErrorMessages(null);
			}

			await setLogin(loginResult);
			setLoading(false);
		},
	});

	return (
		<Container component="main" maxWidth="xs">
			<div className={classes.paper}>
				<Avatar className={classes.avatar}>
					<LockOutlinedIcon />
				</Avatar>
				<Typography component="h1" variant="h5">
					{t('Sign in')}
				</Typography>
				{errorMessages != null && (
					<Alert severity="error">
						<p>{t('Login Failed')}</p>
						<ul>
							{(errorMessages ?? ['Unexpected error']).map(e => (
								<li key={kebabCase(e)}>{t(e)}</li>
							))}
						</ul>
					</Alert>
				)}
				<form className={classes.form} onSubmit={formik.handleSubmit} noValidate>
					<TextField
						variant="outlined"
						margin="normal"
						required
						fullWidth
						id="email"
						label={t('Email Address')}
						name="email"
						autoComplete="email"
						autoFocus
						value={formik.values.email}
						onChange={formik.handleChange}
						error={formik.touched.email && Boolean(formik.errors.email)}
						helperText={formik.touched.email && formik.errors.email}
					/>
					{/* eslint-disable-next-line max-len */}
					<TextField
						variant="outlined"
						margin="normal"
						required
						fullWidth
						name="password"
						label={t('Password')}
						type="password"
						id="password"
						autoComplete="current-password"
						value={formik.values.password}
						onChange={formik.handleChange}
						error={formik.touched.password && Boolean(formik.errors.password)}
						helperText={formik.touched.password && formik.errors.password}
					/>
					<FormControlLabel control={<Checkbox value="remember" color="primary" />} label={t('Remember me')} />
					<LoadingButton type="submit" loading={loading} fullWidth variant="contained" color="primary" className={classes.submit}>
						{t('Sign In')}
					</LoadingButton>
					<Grid container>
						<Grid item xs>
							<Link href="/forgot" variant="body2">
								{t('Forgot password?')}
							</Link>
						</Grid>
						<Grid item>
							<Link href="/register" variant="body2">
								{t("Don't have an account? Sign Up")}
							</Link>
						</Grid>
					</Grid>
				</form>
			</div>
			<Box mt={8}>
				<Copyright />
			</Box>
		</Container>
	);
};

export default Login;
