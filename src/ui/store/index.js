import { applyMiddleware, createStore } from 'redux';
import { connectRouter, routerMiddleware } from 'connected-react-router';
import createSagaMiddleware from 'redux-saga';

import history from '../Router/history';

import rootSaga from './sagas';

const sagaMiddleware = createSagaMiddleware();

const middlewares = [routerMiddleware(history), sagaMiddleware];

const store = createStore(
	connectRouter(history)(() => {}),
	applyMiddleware(...middlewares),
);

sagaMiddleware.run(rootSaga);

export default store;
