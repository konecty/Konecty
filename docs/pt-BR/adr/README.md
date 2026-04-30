# Architecture Decision Records (ADRs)

Este diretório contém as decisões arquiteturais tomadas durante o desenvolvimento do projeto.

## ADRs Disponíveis

- [ADR-0001: HTTP Streaming para Busca de Dados](./0001-http-streaming-para-busca-de-dados.md)
- [ADR-0002: Extração de Lógica Comum para findUtils](./0002-extracao-de-logica-comum-para-find-utils.md)
- [ADR-0003: Node.js Transform Streams para Processamento Sequencial](./0003-node-transform-streams-para-processamento-sequencial.md)
- [ADR-0004: Ordenação Padrão para Consistência](./0004-ordenacao-padrao-para-consistencia.md)
- [ADR-0005: Uso Obrigatório de Nós Secundários para Leitura](./0005-uso-obrigatorio-nos-secundarios-para-leitura.md)
- [ADR-0006: Integração Python para Geração de Pivot Tables](./0006-integracao-python-para-pivot-tables.md)
- [ADR-0007: Formato Hierárquico de Saída do Pivot](./0007-formato-hierarquico-saida-pivot.md)
- [ADR-0008: Endpoint de Gráficos com Polars e Pandas](./0008-graph-endpoint-com-polars-pandas.md)
- [ADR-0009: Estrutura Centralizada de Mensagens de Erro no Backend](./0009-estrutura-mensagens-erro-backend.md)
- [ADR-0010: Padrões de Código](./0010-padroes-codigo.md)
- [ADR-0011: Evitar Tecnocentrismo na Comunicação com Usuários](./0011-evitar-tecnocentrismo-comunicacao.md)
- [ADR-0012: Servidores MCP como Plugins Fastify](./0012-servers-mcp-como-plugins-fastify.md)
- [ADR-0013: Adapter Fastify para Transport Node do MCP](./0013-adapter-fastify-para-transport-node-mcp.md)
- [ADR-0014: Proxy Interno MCP para Serviços Konecty](./0014-proxy-interno-mcp-para-servicos-konecty.md)
- [ADR-0015: Rate Limiting do MCP em Memória](./0015-rate-limiting-mcp-em-memoria.md)
- [ADR-0016: Separação entre User MCP e Admin MCP](./0016-separacao-user-admin-mcp.md)
- [ADR-0017: Conformidade de Widgets com Diretrizes Visuais do ChatGPT](./0017-conformidade-chatgpt-para-widgets.md)
- [ADR-0018: Contrato de Autenticação Stateless por Token no MCP](./0018-contrato-auth-stateless-token-mcp.md)
- [ADR-0019: Desenho de Resposta das Tools MCP](./0019-desenho-de-resposta-content-mcp.md)
- [ADR-0020: API Admin de Metadados (CRUD)](./0020-api-admin-meta-crud.md)

## Formato

Cada ADR segue o formato padrão:
- **Status**: Aceito, Proposto, Rejeitado, Depreciado, Substituído
- **Contexto**: Situação que levou à decisão
- **Decisão**: Decisão tomada
- **Detalhes da Implementação**: Como foi implementado
- **Consequências**: Impactos positivos, negativos e riscos mitigados
- **Alternativas Consideradas**: Outras opções avaliadas
- **Referências**: Links para código relacionado

