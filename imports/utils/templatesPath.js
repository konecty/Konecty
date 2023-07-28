import path from 'path';

export function templatePath() {
	const dirName = path.resolve('.');

	const rootDir = dirName.split('.meteor')[0];

	if (rootDir.indexOf('bundle/programs/server') > 0) {
		return path.join(rootDir, '../../programs/server/assets/app/templates');
	}

	return path.join(rootDir, 'private/templates');
}
