# Especificação - Document Management System

## 1. Objetivo

Disponibilizar uma aplicação web simples para que usuários enviem, consultem e baixem seus próprios documentos, com arquivos guardados no filesystem local da aplicação.

## 2. Escopo

### Dentro do escopo

- Envio de um arquivo por requisição.
- Listagem dos documentos associados ao identificador de usuário informado na requisição.
- Download de documento pelo identificador, limitado ao proprietário registrado.
- Interface web para selecionar usuário, enviar arquivos, consultar a lista e baixar documentos.
- Persistência dos arquivos em `backend/storage` e dos metadados em memória durante a execução do processo.

### Fora do escopo

- Autenticação, autorização baseada em credenciais ou cadastro de usuários.
- Armazenamento externo, nuvem ou banco de dados persistente.
- Versionamento, edição, compartilhamento entre usuários, pastas e exclusão pela interface.
- Garantia de recuperação dos metadados após reinício do processo.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O usuário pode enviar um arquivo pelo campo multipart `file`, informando sua identidade no cabeçalho `X-User-Id`. |
| RF-02 | O sistema atribui ao documento um identificador único, registra nome original, tamanho, data/hora do upload e proprietário. |
| RF-03 | O usuário pode listar somente os documentos cujo proprietário corresponde ao valor de `X-User-Id`. |
| RF-04 | O usuário pode baixar um documento pelo identificador somente quando ele pertence ao usuário informado. |
| RF-05 | O sistema retorna erro `404` tanto para documento inexistente quanto para documento pertencente a outro usuário. |
| RF-06 | O sistema rejeita requisições sem `X-User-Id`, com valor vazio ou com mais de 120 caracteres. |
| RF-07 | O sistema rejeita o envio sem arquivo e uploads que excedam o limite configurado. |
| RF-08 | A interface permite selecionar um identificador de usuário e exibe os arquivos disponíveis para essa identidade. |
| RF-09 | A interface permite selecionar e enviar um arquivo, apresenta erros retornados pela API e permite baixar cada item listado. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Uploads são gravados exclusivamente no filesystem local, usando Multer `diskStorage`; nenhum provedor externo é permitido. |
| RNF-02 | O diretório padrão é `backend/storage`; `STORAGE_DIR` pode definir outro diretório. |
| RNF-03 | O nome físico do arquivo é gerado pelo sistema e não deriva do nome enviado pelo cliente. |
| RNF-04 | Metadados são mantidos em memória e ficam indisponíveis após o reinício do backend. |
| RNF-05 | O limite padrão de upload é 10 MiB e pode ser substituído por `MAX_FILE_SIZE_BYTES`. |
| RNF-06 | A porta HTTP é configurável pela variável `PORT`, com padrão `3000`. |
| RNF-07 | O backend usa Node.js, Express e CommonJS; o frontend usa React, Vite e ES modules. |
| RNF-08 | Erros de entrada e de upload são retornados como JSON consistente; respostas de upload, listagem e download têm códigos HTTP apropriados. |
| RNF-09 | Chamadas do frontend usam o prefixo `/api`; o proxy Vite de desenvolvimento remove esse prefixo antes de encaminhar ao backend. |

## 5. Modelo de dados

### Metadados públicos do documento

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string (UUID) | Identificador único usado nas rotas de download. |
| `originalName` | string | Nome original apresentado pelo usuário no upload; nunca é usado como caminho físico. |
| `size` | number | Tamanho do arquivo em bytes. |
| `uploadedAt` | string (ISO 8601) | Data e hora do recebimento do arquivo em UTC. |
| `owner` | string | Identificador recebido em `X-User-Id`, com até 120 caracteres. |

O repositório mantém também um `storageName` interno, gerado pelo servidor, para localizar o arquivo local. Esse campo não é exposto na API. O conteúdo do arquivo fica em disco; os metadados ficam em memória.

## 6. Contratos de API

As rotas do backend são `/upload`, `/documents` e `/documents/:id/download`. No desenvolvimento web, o frontend chama os caminhos equivalentes sob `/api`; o proxy Vite remove `/api` antes do encaminhamento. Todas as rotas de documentos exigem `X-User-Id`.

### `POST /api/upload`

- Entrada: `multipart/form-data`, campo de arquivo obrigatório `file`; cabeçalho `X-User-Id` obrigatório.
- Sucesso: `201 Created`, corpo com os metadados públicos do documento.
- Erros: `400 Bad Request` para identidade ou formulário inválidos; `413 Payload Too Large` quando o arquivo ultrapassa o limite; `500 Internal Server Error` para falha inesperada.

Exemplo de sucesso:

```json
{
  "id": "e971f2e1-e5ef-45c0-8041-ac685a43ec99",
  "originalName": "relatorio.pdf",
  "size": 48210,
  "uploadedAt": "2026-10-06T12:00:00.000Z",
  "owner": "usuario-123"
}
```

### `GET /api/documents`

- Entrada: cabeçalho `X-User-Id` obrigatório.
- Sucesso: `200 OK`, corpo `{ "documents": [...] }`; a lista contém apenas documentos do usuário e vem ordenada do mais recente para o mais antigo.
- Erro: `400 Bad Request` para identidade ausente ou inválida.

### `GET /api/documents/:id/download`

- Entrada: UUID do documento na rota e cabeçalho `X-User-Id` obrigatório.
- Sucesso: `200 OK`, conteúdo binário do arquivo como anexo, com o nome original como nome de download.
- Erros: `400 Bad Request` para identidade inválida; `404 Not Found` para documento inexistente, não pertencente ao usuário ou cujo arquivo local não esteja disponível; `500 Internal Server Error` para falha de leitura.

### Formato de erro

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "O arquivo excede o tamanho máximo permitido."
  }
}
```

`GET /health` retorna `200 OK` com `{ "status": "ok" }` e não requer identidade.

## 7. Decisões arquiteturais

- Backend: `routes → controllers → services → repositories`. Rotas configuram os endpoints e o middleware Multer; controllers validam HTTP e formam respostas; services aplicam as regras de propriedade e metadados; repositories abstraem a coleção em memória e os arquivos locais.
- Multer usa `diskStorage` no diretório local configurado e nomes físicos UUID. O original permanece somente nos metadados para apresentação e download.
- O repositório de documentos é em memória. O repositório local resolve e remove arquivos dentro do diretório de armazenamento.
- Frontend: componentes funcionais React, serviço dedicado com `fetch` e proxy Vite `/api`.
- `X-User-Id` é somente um identificador declarado pelo cliente, não prova identidade. O isolamento por proprietário atende ao escopo de demonstração, mas não é uma fronteira de segurança adequada para produção.
- Reiniciar o processo limpa os metadados em memória, embora os bytes dos arquivos permaneçam no diretório. A limpeza/recuperação de arquivos órfãos está fora do escopo inicial.

## 8. Plano de execução

1. Confirmar este contrato, o limite de upload, os campos públicos e a semântica de proprietário.
2. Implementar as rotas e camadas do backend para upload local, listagem por proprietário, download autorizado e erros padronizados.
3. Implementar a interface web para identidade de demonstração, upload, atualização da lista, estados vazios/erro e download.
4. Validar os fluxos ponta a ponta, isolamento entre usuários, limites de tamanho e build da interface.
5. Revisar a documentação e registrar como configurar diretório, limite e porta para execução local.