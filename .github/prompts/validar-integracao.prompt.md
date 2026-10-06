---
description: "Validar o fluxo de documentos entre React e Express."
agent: dms-integrator
---

Valide a integração de upload, listagem e download do DMS.

Confira:

- Prefixo /api e encaminhamento pelo proxy Vite.
- Cabeçalho X-User-Id e campo multipart file.
- Atualização da lista após upload.
- Download binário com nome original.
- Estados de carregamento, lista vazia e erros.

Corrija somente divergências desse fluxo, preservando a arquitetura,
os testes existentes e o armazenamento local.

Execute os testes pertinentes e o build do frontend.
Apresente os resultados e as limitações da validação.