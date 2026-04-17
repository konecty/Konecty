import path from 'path';

/**
 * Main file basename (e.g. `hash.png` or `logo-agencia-x.png`). Thumbnails are always
 * `thumbnail/{stem}.jpeg` per upload route; watermark uses `watermark/{stem}.jpeg`.
 */
export function getFileStorageDeletePathSuffixes(mainBasenameDecoded: string, hasWatermark: boolean): string[] {
	const ext = path.posix.extname(mainBasenameDecoded);
	const stem = ext.length > 0 ? mainBasenameDecoded.slice(0, -ext.length) : mainBasenameDecoded;

	const suffixes = [mainBasenameDecoded, path.posix.join('thumbnail', mainBasenameDecoded), path.posix.join('thumbnail', `${stem}.jpeg`)];

	if (hasWatermark) {
		suffixes.push(path.posix.join('watermark', mainBasenameDecoded));
		suffixes.push(path.posix.join('watermark', `${stem}.jpeg`));
	}

	return [...new Set(suffixes)];
}
