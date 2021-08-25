import { call, put, takeEvery, takeLatest } from 'redux-saga/effects';

function* fetchUser(action) {
	try {
		//   const user = yield call(Api.fetchUser, action.payload.userId);
		yield put({ type: 'USER_FETCH_SUCCEEDED', user: {} });
	} catch (e) {
		yield put({ type: 'USER_FETCH_FAILED', message: e.message });
	}
}

function* mainSaga() {
	yield takeLatest('USER_FETCH_REQUESTED', fetchUser);
}

export default mainSaga;
