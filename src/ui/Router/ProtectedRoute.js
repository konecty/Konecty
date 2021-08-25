import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';

const ProtectedRoute = ({ component: Component, ...props }) => {
	const isLogged = useSelector(state => state?.user?.isLogged);

	if (isLogged === true) {
		// eslint-disable-next-line react/jsx-props-no-spreading
		return <Route component={Component} {...props} />;
	}

	return <Redirect to="/login" />;
};

ProtectedRoute.propTypes = {
	component: PropTypes.element.isRequired,
};

export default ProtectedRoute;
