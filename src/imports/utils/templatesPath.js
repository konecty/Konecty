import path from 'path';

export function templatePath() {
	const dirName = path.resolve('.');
	
	if (process.env.NODE_ENV === 'production') {
		return path.join(dirName, './private/templates');
	}

	return path.join(dirName, './src/private/templates');
}
