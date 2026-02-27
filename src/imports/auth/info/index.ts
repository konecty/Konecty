import { getUser } from '@imports/auth/getUser';
import { MetaObject } from '@imports/model/MetaObject';

interface UserInfoResponse {
	logged: boolean;
	user: {
		_id: string;
		access?: {
			[key: string]: Array<String>;
		};
		admin?: boolean;
		email?: string;
		group?: {
			_id: string;
			name: string;
		};
		locale?: string;
		login?: string;
		name?: string;
		namespace?: {
			_id: string;
			logoURL?: string;
			siteURL: string;
			title: string;
		};
		role?: {
			_id: string;
			name: string;
		};
	} | null;
}

export async function userInfo(authTokenId?: string | null | undefined): Promise<UserInfoResponse> {
	const namespace = {
		_id: MetaObject.Namespace.ns,
		logoURL: MetaObject.Namespace.logoURL,
		siteURL: MetaObject.Namespace.siteURL,
		title: MetaObject.Namespace.title,
		watermark: MetaObject.Namespace.watermark,
		addressComplementValidation: MetaObject.Namespace.addressComplementValidation,
		addressSource: MetaObject.Namespace.addressSource,
		enableCustomThemes: (MetaObject.Namespace as { enableCustomThemes?: boolean }).enableCustomThemes !== false,
	};

	try {
		const user = await getUser(authTokenId);
		const response: UserInfoResponse = {
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
		if (/^\[get-user\]/.test((error as Error).message)) {
			return {
				logged: false,
				user: null,
			};
		}
	}
	return {
		logged: false,
		user: null,
	};
}
