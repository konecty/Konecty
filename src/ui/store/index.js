import { applyMiddleware, createStore, compose } from 'redux';
import { routerMiddleware as createRouterMiddleware } from 'connected-react-router';
import createSagaMiddleware from 'redux-saga';

import history from '../Router/history';

import rootSaga from './sagas';

import rootReducer from './rootReducer';

const sagaMiddleware = createSagaMiddleware();
const routerMiddleware = createRouterMiddleware(history);
const composeEnhancers = (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;

const store = createStore(rootReducer, composeEnhancers(applyMiddleware(routerMiddleware, sagaMiddleware)));

sagaMiddleware.run(rootSaga);

export default store;
