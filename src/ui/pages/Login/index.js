import React, { useMemo } from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import Container from '@material-ui/core/Container';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useTranslation } from 'react-i18next';

import Copyright from './Copyright';
import useStyles from './style';

const Login = () => {
	const classes = useStyles();
	const { t } = useTranslation();

	const validationSchema = useMemo(() =>
		yup.object({
			email: yup.string(t('Enter your email')).email(t('Enter a valid email')).required(t('Email is required')),
			password: yup.string(t('Enter your password')).min(8, t('Password should be of minimum 8 characters length')).required(t('Password is required')),
		}),
	);

	const formik = useFormik({
		initialValues: {
			email: '',
			password: '',
		},
		validationSchema,
		onSubmit: values => {
			alert(JSON.stringify(values, null, 2));
		},
	});

	return (
		<Container component="main" maxWidth="xs">
			<CssBaseline />
			<div className={classes.paper}>
				<Avatar className={classes.avatar}>
					<LockOutlinedIcon />
				</Avatar>
				<Typography component="h1" variant="h5">
					{t('Sign in')}
				</Typography>
				<form className={classes.form} onSubmit={formik.handleSubmit}>
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
					<Button type="submit" fullWidth variant="contained" color="primary" className={classes.submit}>
						{t('Sign In')}
					</Button>
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
