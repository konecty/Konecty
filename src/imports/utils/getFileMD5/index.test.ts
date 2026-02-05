import fs from 'fs/promises';
import path from 'path';
import getFileMD5 from './';

describe('getFileMD5', () => {
	const EXPECTED_MD5 = '2ebdbf7e5432670be2c127f5260a2bef';
	const TEST_IMAGE_PATH = path.resolve(process.cwd(), '__test__/fixtures/img/logo-konecty.png');

	it('deve calcular corretamente o hash MD5 de um arquivo', async () => {
		try {
			// Carrega o arquivo de teste
			const fileBuffer = await fs.readFile(TEST_IMAGE_PATH);

			// Calcula o MD5 usando nossa função
			const md5Hash = getFileMD5(fileBuffer);

			// Verifica se o hash calculado corresponde ao esperado
			expect(md5Hash).toBe(EXPECTED_MD5);
		} catch (erro) {
			console.error('Erro ao testar getFileMD5:', erro);
			throw erro;
		}
	});
});
