async function readResponse(response) {
  if (response.ok) return response;

  const body = await response.json().catch(() => null);
  throw new Error(body?.error?.message || 'Não foi possível concluir a operação.');
}

export async function listDocuments(ownerId, options = {}) {
  const response = await fetch('/api/documents', {
    headers: { 'X-User-Id': ownerId },
    signal: options.signal,
  });
  return (await readResponse(response)).json();
}

export async function uploadDocument(ownerId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'X-User-Id': ownerId },
    body: formData,
  });
  return (await readResponse(response)).json();
}

export async function downloadDocument(ownerId, documentId) {
  const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/download`, {
    headers: { 'X-User-Id': ownerId },
  });
  return (await readResponse(response)).blob();
}