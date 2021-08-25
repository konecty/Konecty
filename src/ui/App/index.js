import React from 'react';
import ReactDOM from 'react-dom';

import { Provider } from 'react-redux';

import store from 'ui/store';

import Router from 'ui/Router';

ReactDOM.render(
	<Provider store={store}>
		<Router />
	</Provider>,
	document.getElementById('main'),
);
