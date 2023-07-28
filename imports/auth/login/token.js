import crypto from 'crypto';
import { randomSecret } from '/imports/utils/random';

export function generateStampedLoginToken() {
	const stampedToken = {
		token: randomSecret(),
		when: new Date(),
	};

	const hashStampedToken = {
		when: stampedToken.when,
		hashedToken: crypto.createHash('sha256').update(stampedToken.token).digest('base64'),
	};

	return hashStampedToken;
}
