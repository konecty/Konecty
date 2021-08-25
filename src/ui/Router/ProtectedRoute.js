import React from 'react';
import { Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';

import Login from 'ui/pages/Login';

const ProtectedRoute = ({ component: Component, ...rest }) => {
	const isLogged = useSelector(state => state?.user?.isLogged);
	// const isLogged = false;
	return (
		<Route
			// eslint-disable-next-line react/jsx-props-no-spreading
			{...rest}
			render={props => {
				if (isLogged === true) {
					// eslint-disable-next-line react/jsx-props-no-spreading
					return <Component {...props} />;
				}
				return <Login />;
			}}
		/>
	);
};

ProtectedRoute.propTypes = {
	component: PropTypes.oneOfType([PropTypes.element, PropTypes.func]).isRequired,
};

export default ProtectedRoute;
