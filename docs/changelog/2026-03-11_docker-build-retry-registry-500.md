# Changelog: Docker build retry and develop workflow checkout fix

## Resumo

Adicionado retry na etapa `yarn install` do Dockerfile para falhas transientes do registry (500) e uso de cache do Yarn no build. Corrigida a referência de checkout no workflow develop para usar o tag que disparou o pipeline.

## Motivação

O build da imagem Docker no GitHub Actions falhava em linux/arm64 com `500 Internal Server Error` ao baixar pacotes (ex.: `unpipe`) do registry.yarnpkg.com. Falhas 500 são transientes. Além disso, o job de build do workflow develop fazia checkout com `steps.latestrelease.outputs.releasetag`, que não existe nesse workflow, podendo construir a imagem a partir do ref errado.

## O que mudou

- **Dockerfile:** A etapa `RUN yarn install ...` passou a tentar até 3 vezes, com 15s de espera entre tentativas, e a usar cache mount do BuildKit para o Yarn (`/usr/local/share/.cache/yarn`), reduzindo chamadas ao registry e acelerando builds.
- **develop.yaml:** O step de Checkout do job `build` usa `ref: ${{ github.ref }}`, garantindo que o build use o tag que disparou o workflow (ex.: `3.5.0-dev.8`).

## Impacto técnico

- Builds Docker ficam mais resilientes a falhas temporárias do registry.
- Builds subsequentes podem ser mais rápidos graças ao cache do Yarn no BuildKit.
- Imagens de develop passam a ser construídas a partir do tag correto.

## Impacto externo

Nenhum para usuários finais. CI/CD mais estável para quem publica imagens.

## Como validar

1. Disparar o workflow develop com um tag no formato `*-dev.*` (ex.: `3.5.0-dev.9`) ou reexecutar um run existente.
2. Verificar que o job de build conclui para linux/amd64 e linux/arm64.
3. Confirmar que a imagem no Docker Hub está taggeada com o valor esperado (ex.: `konecty/konecty:3.5.0-dev.9`).

## Arquivos afetados

- `Dockerfile`
- `.github/workflows/develop.yaml`

## Existe migração?

Não.
