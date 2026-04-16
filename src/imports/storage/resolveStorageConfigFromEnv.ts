import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '@imports/utils/logger';

const DEFAULT_SFTP_PORT = 22;

/**
 * When `KONECTY_STORAGE_TYPE=sftp`, merge SFTP connection settings from env onto
 * `MetaObject.Namespace.storage`, preserving image-related options from Mongo (thumbnail, wm, jpeg, imageSizes, maxFileSize).
 */
export function applyStorageEnvOverride(): void {
	const storageType = process.env.KONECTY_STORAGE_TYPE?.toLowerCase();
	if (storageType !== 'sftp') {
		return;
	}

	const host = process.env.KONECTY_SFTP_HOST?.trim();
	const username = process.env.KONECTY_SFTP_USER?.trim();
	const remoteRoot = process.env.KONECTY_SFTP_REMOTE_ROOT?.trim();
	const password = process.env.KONECTY_SFTP_PASSWORD ?? '';

	if (host === '' || host == null || username === '' || username == null || remoteRoot === '' || remoteRoot == null) {
		logger.warn(
			{ hasHost: Boolean(host), hasUser: Boolean(username), hasRemoteRoot: Boolean(remoteRoot) },
			'SFTP env override skipped: missing KONECTY_SFTP_HOST, KONECTY_SFTP_USER or KONECTY_SFTP_REMOTE_ROOT',
		);
		return;
	}

	const portRaw = process.env.KONECTY_SFTP_PORT;
	const parsedPort = portRaw != null && portRaw !== '' ? Number(portRaw) : DEFAULT_SFTP_PORT;
	const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_SFTP_PORT;

	const existing = MetaObject.Namespace.storage;
	const preserved = {
		wm: existing?.wm,
		thumbnail: existing?.thumbnail,
		jpeg: existing?.jpeg,
		imageSizes: existing?.imageSizes,
		maxFileSize: existing?.maxFileSize,
	};

	Object.assign(MetaObject.Namespace, {
		storage: {
			...preserved,
			type: 'sftp' as const,
			host,
			port,
			username,
			password,
			remoteRoot,
		},
	});

	logger.info({ host, port, remoteRoot }, 'Namespace.storage overridden by SFTP environment');
}
