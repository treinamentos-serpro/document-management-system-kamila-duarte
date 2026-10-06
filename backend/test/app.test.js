const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const app = require('../src/app');
async function createTestContext(context, options = {}) {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-isolated-'));
  const storageDirectory = path.join(temporaryDirectory, 'storage');
  let server;
 
  context.after(async () => {
    try {
      if (server?.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    } finally {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  const testApp = app.createApp({ ...options, storageDirectory });
  server = testApp.listen(0, '127.0.0.1');
  await once(server, 'listening');

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    storageDirectory,
  };
}

function createUploadForm(content = 'document content', filename = 'document.txt', field = 'file') {
  const form = new FormData();
  form.append(field, new Blob([content]), filename);
  return form;
}

test('health responde sem exigir identidade', async (context) => {
  const { baseUrl } = await createTestContext(context);
  const response = await fetch(`${baseUrl}/health`);

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await response.json(), { status: 'ok' });
});

test('lista vazia em uma nova instância do app', async (context) => {
  const { baseUrl } = await createTestContext(context);
  const response = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'user-1' },
  });

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await response.json(), { documents: [] });
});

test('upload sem identidade é rejeitado antes de gravar em disco', async (context) => {
  const { baseUrl, storageDirectory } = await createTestContext(context);
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: createUploadForm(),
  });

  assert.strictEqual(response.status, 400);
  assert.strictEqual((await response.json()).error.code, 'INVALID_USER');
  assert.deepStrictEqual(await fs.readdir(storageDirectory), []);
});

test('identidade acima de 120 caracteres é rejeitada', async (context) => {
  const { baseUrl } = await createTestContext(context);
  const response = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'u'.repeat(121) },
  });

  assert.strictEqual(response.status, 400);
  assert.strictEqual((await response.json()).error.code, 'INVALID_USER');
});

test('upload sem arquivo retorna FILE_REQUIRED', async (context) => {
  const { baseUrl, storageDirectory } = await createTestContext(context);
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-1' },
  });

  assert.strictEqual(response.status, 400);
  assert.strictEqual((await response.json()).error.code, 'FILE_REQUIRED');
  assert.deepStrictEqual(await fs.readdir(storageDirectory), []);
});

test('campo de arquivo inesperado é rejeitado sem deixar arquivos', async (context) => {
  const { baseUrl, storageDirectory } = await createTestContext(context);
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-1' },
    body: createUploadForm('content', 'document.txt', 'attachment'),
  });

  assert.strictEqual(response.status, 400);
  assert.strictEqual((await response.json()).error.code, 'INVALID_UPLOAD');
  assert.deepStrictEqual(await fs.readdir(storageDirectory), []);
});

test('upload grava bytes em disco com nome gerado e metadados públicos', async (context) => {
  const { baseUrl, storageDirectory } = await createTestContext(context);
  const content = 'conteúdo de teste';
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-1' },
    body: createUploadForm(content, 'report.txt'),
  });
  const document = await response.json();
  const filenames = await fs.readdir(storageDirectory);

  assert.strictEqual(response.status, 201);
  assert.match(document.id, /^[0-9a-f-]{36}$/);
  assert.strictEqual(document.originalName, 'report.txt');
  assert.strictEqual(document.owner, 'user-1');
  assert.strictEqual(document.size, Buffer.byteLength(content));
  assert.strictEqual(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
  assert.deepStrictEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
  assert.strictEqual(filenames.length, 1);
  assert.notStrictEqual(filenames[0], 'report.txt');
  assert.strictEqual(await fs.readFile(path.join(storageDirectory, filenames[0]), 'utf8'), content);
});

test('arquivo exatamente no limite de tamanho é aceito', async (context) => {
  const { baseUrl } = await createTestContext(context, { maxFileSizeBytes: 32 });
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-1' },
    body: createUploadForm('x'.repeat(32)),
  });

  assert.strictEqual(response.status, 201);
  assert.strictEqual((await response.json()).size, 32);
});

test('arquivo acima do limite não deixa arquivo nem metadados', async (context) => {
  const { baseUrl, storageDirectory } = await createTestContext(context, { maxFileSizeBytes: 32 });
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-1' },
    body: createUploadForm('x'.repeat(33)),
  });

  assert.strictEqual(response.status, 413);
  assert.strictEqual((await response.json()).error.code, 'FILE_TOO_LARGE');
  assert.deepStrictEqual(await fs.readdir(storageDirectory), []);

  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'user-1' },
  });
  assert.deepStrictEqual(await listResponse.json(), { documents: [] });
});

test('download de documento inexistente retorna DOCUMENT_NOT_FOUND', async (context) => {
  const { baseUrl } = await createTestContext(context);
  const response = await fetch(`${baseUrl}/documents/unknown/download`, {
    headers: { 'X-User-Id': 'user-1' },
  });

  assert.strictEqual(response.status, 404);
  assert.strictEqual((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('download retorna 404 quando o arquivo físico não está disponível', async (context) => {
  const { baseUrl, storageDirectory } = await createTestContext(context);
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-1' },
    body: createUploadForm(),
  });
  assert.strictEqual(uploadResponse.status, 201);
  const document = await uploadResponse.json();
  const [filename] = await fs.readdir(storageDirectory);
  await fs.unlink(path.join(storageDirectory, filename));

  const response = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'user-1' },
  });

  assert.strictEqual(response.status, 404);
  assert.strictEqual((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

// Teste de fumaça do seed: garante que o app Express foi exportado.
// Novos testes serão adicionados durante os Steps 2, 6 e 7 com auxílio do Copilot.
test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('gerencia documentos localmente e restringe o acesso ao proprietário', async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const storageDirectory = path.join(temporaryDirectory, 'storage');
  const testApp = app.createApp({ storageDirectory, maxFileSizeBytes: 32 });
  const server = testApp.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const form = new FormData();
    form.append('file', new Blob(['hello document'], { type: 'text/plain' }), 'hello.txt');
    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'user-1' },
      body: form,
    });
    const document = await uploadResponse.json();

    assert.strictEqual(uploadResponse.status, 201);
    assert.deepStrictEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    assert.strictEqual(document.originalName, 'hello.txt');
    assert.strictEqual(document.owner, 'user-1');

    const ownerListResponse = await fetch(`${baseUrl}/documents`, {
      headers: { 'X-User-Id': 'user-1' },
    });
    assert.deepStrictEqual(await ownerListResponse.json(), { documents: [document] });

    const otherUserListResponse = await fetch(`${baseUrl}/documents`, {
      headers: { 'X-User-Id': 'user-2' },
    });
    assert.deepStrictEqual(await otherUserListResponse.json(), { documents: [] });

    const forbiddenDownloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
      headers: { 'X-User-Id': 'user-2' },
    });
    assert.strictEqual(forbiddenDownloadResponse.status, 404);

    const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
      headers: { 'X-User-Id': 'user-1' },
    });
    assert.strictEqual(downloadResponse.status, 200);
    assert.strictEqual(await downloadResponse.text(), 'hello document');

    const missingOwnerResponse = await fetch(`${baseUrl}/documents`);
    assert.strictEqual(missingOwnerResponse.status, 400);

    const largeForm = new FormData();
    largeForm.append('file', new Blob(['x'.repeat(33)]), 'large.txt');
    const oversizedResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'user-1' },
      body: largeForm,
    });
    assert.strictEqual(oversizedResponse.status, 413);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});
