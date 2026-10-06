const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const app = require('../src/app');

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
