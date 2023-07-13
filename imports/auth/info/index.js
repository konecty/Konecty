import { getUser } from '/imports/auth/getUser';
import { Namespace } from '/imports/model/MetaObject';

export async function userInfo(authTokenId) {
	const namespace = {
		_id: Namespace.ns,
		logoURL: Namespace.logoURL,
		siteURL: Namespace.siteURL,
		title: Namespace.title,
	};

	try {
		const user = await getUser(authTokenId);
		const response = {
			logged: true,
			user: {
				_id: user._id,
				access: user.access,
				admin: user.admin,
				email: (user.emails ?? [])[0]?.address,
				group: user.group,
				locale: user.locale,
				login: user.username,
				name: user.name,
				namespace,
				role: user.role,
			},
		};

		return response;
	} catch (error) {
        console.log(error);
		if (/^\[get-user\]/.test(error.message)) {
			return {
				logged: false,
				user: null,
			};
		}
	}
}
