import { proxy } from 'valtio';
import Cookies from 'js-cookie';

const userStore = proxy({
	isLogged: new Promise(resolve => {
		const token = Cookies.get('token');
		if (token == null) {
			return resolve(false);
		}

		console.dir({ token });
		return resolve(true);
	}).then(),

	isLoading: true,
});

export default userStore;
