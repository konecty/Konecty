import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = new URL('.', import.meta.url).pathname;
const distDir = path.join(projectRoot, 'dist');

const entries = [
	{ name: 'records-table', entry: 'src/records-table/index.tsx' },
	{ name: 'pivot', entry: 'src/pivot/index.tsx' },
	{ name: 'graph', entry: 'src/graph/index.tsx' },
	{ name: 'record-detail', entry: 'src/record-detail/index.tsx' },
	{ name: 'record-card', entry: 'src/record-card/index.tsx' },
	{ name: 'file-preview', entry: 'src/file-preview/index.tsx' },
];

await mkdir(distDir, { recursive: true });

await Promise.all(
	entries.map(({ name, entry }) =>
		build({
			entryPoints: [path.join(projectRoot, entry)],
			bundle: true,
			platform: 'browser',
			format: 'esm',
			target: ['es2022'],
			outfile: path.join(distDir, `${name}.js`),
			minify: false,
			loader: {
				'.json': 'json',
			},
		}),
	),
);
