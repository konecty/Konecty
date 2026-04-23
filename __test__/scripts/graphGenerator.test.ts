import path from 'node:path';
import { spawn } from 'node:child_process';
const GRAPH_SCRIPT_TIMEOUT_MS = 30_000;
const XTICK_LABEL_RE = /<g id="xtick_\d+">[\s\S]*?<text[^>]*>([^<]+)<\/text>/g;

interface GraphRunParams {
	config: Record<string, unknown>;
	rows: Array<Record<string, unknown>>;
}

const runGraphGenerator = async ({ config, rows }: GraphRunParams): Promise<string> =>
	new Promise((resolve, reject) => {
		const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'python', 'graph_generator.py');
		const pythonProcess = spawn('uv', ['run', '--script', scriptPath], {
			cwd: process.cwd(),
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';

		const timeoutId = setTimeout(() => {
			pythonProcess.kill('SIGKILL');
			reject(new Error(`graph_generator.py timed out after ${GRAPH_SCRIPT_TIMEOUT_MS}ms`));
		}, GRAPH_SCRIPT_TIMEOUT_MS);

		pythonProcess.stdout.on('data', chunk => {
			stdout += chunk.toString();
		});

		pythonProcess.stderr.on('data', chunk => {
			stderr += chunk.toString();
		});

		pythonProcess.on('error', error => {
			clearTimeout(timeoutId);
			reject(error);
		});

		pythonProcess.on('close', code => {
			clearTimeout(timeoutId);
			if (code !== 0) {
				reject(new Error(stderr || `graph_generator.py exited with code ${code}`));
				return;
			}

			const firstNewlineIndex = stdout.indexOf('\n');
			const rpcLine = firstNewlineIndex >= 0 ? stdout.slice(0, firstNewlineIndex).trim() : stdout.trim();
			const svg = firstNewlineIndex >= 0 ? stdout.slice(firstNewlineIndex + 1).trim() : '';
			const rpcResponse = JSON.parse(rpcLine) as { error?: { message?: string } };
			if (rpcResponse.error != null) {
				reject(new Error(rpcResponse.error.message ?? 'Python RPC error'));
				return;
			}

			resolve(svg);
		});

		const request = {
			jsonrpc: '2.0',
			method: 'graph',
			params: { config, lang: 'pt_BR' },
		};

		pythonProcess.stdin.write(`${JSON.stringify(request)}\n`);
		rows.forEach(row => pythonProcess.stdin.write(`${JSON.stringify(row)}\n`));
		pythonProcess.stdin.end();
	});

describe('graph_generator.py', () => {
	it('agrega gráfico de linha temporal por dia sem repetir timestamps do mesmo dia', async () => {
		const svg = await runGraphGenerator({
			config: {
				type: 'line',
				xAxis: { field: '_createdAt', bucket: 'D', label: 'Criado em' },
				series: [{ field: 'code', aggregation: 'count', label: 'Código' }],
				aggregation: 'count',
				xAxisSort: 'chronological',
				limitOrder: 'asc',
				width: 800,
				height: 600,
			},
			rows: [
				{ _createdAt: '2026-03-31T10:00:00.000Z', code: 'A1' },
				{ _createdAt: '2026-03-31T15:30:00.000Z', code: 'A2' },
				{ _createdAt: '2026-04-01T09:45:00.000Z', code: 'B1' },
			],
		});

		const tickLabels = Array.from(svg.matchAll(XTICK_LABEL_RE))
			.map(([, label]) => label?.trim())
			.filter((value): value is string => Boolean(value));

		expect(tickLabels).toEqual(['2026-03-31', '2026-04-01']);
		expect(svg).not.toContain('2026-03-31T10:00:00.000Z');
		expect(svg).not.toContain('2026-03-31T15:30:00.000Z');
	});
});
