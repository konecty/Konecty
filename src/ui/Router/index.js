import React from 'react';
import { Switch, Route } from 'react-router-dom';
import { ConnectedRouter } from 'connected-react-router';

import ProtectedRoute from './ProtectedRoute';
import Home from '../pages/Home';
import Login from '../pages/Login';

import history from './history';

const Routes = () => (
	<ConnectedRouter history={history}>
		<Switch>
			<Route path="/login" component={Login} />
			<ProtectedRoute exact path="/" component={Home} />
		</Switch>
	</ConnectedRouter>
);

export default Routes;
