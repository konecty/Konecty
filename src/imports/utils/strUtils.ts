import path from 'path';

export function filePathWithoutExtension(filePath: string) {
	return path.basename(filePath, path.extname(filePath));
}
