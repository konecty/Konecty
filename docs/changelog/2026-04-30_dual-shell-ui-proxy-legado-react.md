# Changelog — Alternância entre interface clássica (Ext) e nova (React)

- **Summary:** Preferência explícita (`new` / `legacy`) persistida em `localStorage`, sincronizada por query string ao cruzar origens, com CTAs claros no shell legado (“Experimente a nova interface”) e navegação configurável para abrir o gestor React em mesma origem (`/ui/`) ou URL absoluta em desenvolvimento; infraestrutura no Konecty serve Ext em `/` e o SPA novo sob `UI_PROXY_PATH`.
- **Motivation:** Usuários e desenvolvedores precisam alternar entre o shell Ext legado e o gestor React sem loop de redirect entre `:3000` e `:3001`, com uma única fonte de verdade para a escolha de interface e sem substituir toda a raiz do site quando só o gestor novo deve ficar montado em `/ui`.
- **What changed:**
  - **`index.hbs`:** leitura/gravação da preferência (`konecty-ui-version`), sync via `konectyUiShell` na URL (aplica `new`/`legacy`, remove o parâmetro), bootstrap de redirect quando a preferência é “nova” na landing `/`, injeção do CTA ao lado do usuário antes do split de bundles remotos.
  - **`view.ts`:** destino do link “nova interface” respeita `UI_NEW_UI_BROWSER_PATH` e, em desenvolvimento com `UI_PROXY_URL` HTTP(S), pode abrir diretamente o dev server do gestor quando não há override.
  - **`routes/index.ts`:** proxy GET/HEAD do SPA apenas em `UI_PROXY_PATH` com `rewritePrefix: '/'`; modo `UI_PROXY=true` permanece opcional para quem quer proxy total da raiz; CORS inclui a origem do gestor quando configurada.
  - **`.env.example` / `README`:** documentação das variáveis do modo dual-shell (`UI_PROXY_PATH`, `UI_PROXY_URL`, `UI_NEW_UI_BROWSER_PATH`, `ALLOWED_ORIGINS`).
- **Technical impact:** APIs permanecem no Konecty; o gestor React é servido por proxy ou build estático conforme deploy, sempre com caminho de montagem previsível para `BASE_URL=/ui/`.
- **External impact:** Fluxo visível de experimentação da nova interface a partir do legado e retorno ao clássico pela nova UI (implementado no repo `ui`), com preferência estável entre reloads.
- **How to validate:** Com dual-shell ativo, na interface legada usar o CTA e confirmar abertura do gestor conforme env; alternar preferência e recarregar sem loop; opcionalmente validar query `?konectyUiShell=new|legacy` aplicando a escolha e limpando a URL.
- **Affected files:** `src/private/templates/index.hbs`, `src/server/routes/rest/view/view.ts`, `src/server/routes/index.ts`, `.env.example`, `README.md`, `docs/changelog/2026-04-30_dual-shell-ui-proxy-legado-react.md`, `docs/changelog/README.md`
- **Migration required?** Não. Adotar dual-shell implica configurar env no deploy conforme documentado.
