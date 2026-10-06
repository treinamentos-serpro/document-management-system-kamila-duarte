async function readResponse(response) {
  if (response.ok) return response;

  const body = await response.json().catch(() => null);
  throw new Error(body?.error?.message || 'Não foi possível concluir a operação.');
}

async function request(path, ownerId, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'X-User-Id': ownerId },
  });
  return readResponse(response);
}

export async function listDocuments(ownerId, options = {}) {
  const response = await request('/documents', ownerId, {
    signal: options.signal,
  });
  return response.json();
}

export async function uploadDocument(ownerId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', ownerId, {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

export async function downloadDocument(ownerId, documentId) {
  const response = await request(`/documents/${encodeURIComponent(documentId)}/download`, ownerId);
  return response.blob();
}