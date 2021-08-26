import React from 'react';
import { Switch, Route, BrowserRouter } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Home from 'ui/pages/Home';
import Login from 'ui/pages/Login';

import userStore from 'ui/store/user';

const Router = () => {
	const { isLogged } = useSnapshot(userStore);

	if (isLogged === false) {
		return <Login />;
	}
	return (
		<BrowserRouter>
			<Switch>
				<Route exact path="/" component={Home} />
			</Switch>
		</BrowserRouter>
	);
};

export default Router;
