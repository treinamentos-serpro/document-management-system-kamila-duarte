import { useEffect, useRef, useState } from 'react';
import { downloadDocument, listDocuments, uploadDocument } from './services/documents.js';
import './styles.css';

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function App() {
  const [ownerId, setOwnerId] = useState('demo-user');
  const [ownerInput, setOwnerInput] = useState('demo-user');
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const fileInput = useRef(null);

  useEffect(() => {
    let isCurrent = true;
    const abortController = new AbortController();

    setLoading(true);
    setError('');

    listDocuments(ownerId, { signal: abortController.signal })
      .then((result) => {
        if (isCurrent) setDocuments(result.documents);
      })
      .catch((requestError) => {
        if (isCurrent && requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [ownerId]);

  async function handleIdentitySubmit(event) {
    event.preventDefault();
    const nextOwner = ownerInput.trim();
    if (!nextOwner) {
      setError('Informe um identificador de usuário.');
      return;
    }
    setOwnerId(nextOwner);
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile) {
      setError('Selecione um arquivo para enviar.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      await uploadDocument(ownerId, selectedFile);
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = '';
      const result = await listDocuments(ownerId);
      setDocuments(result.documents);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(document) {
    setDownloadingId(document.id);
    setError('');
    try {
      const file = await downloadDocument(ownerId, document.id);
      const downloadUrl = URL.createObjectURL(file);
      const link = window.document.createElement('a');
      link.href = downloadUrl;
      link.download = document.originalName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Arquivo, início">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>Arquivo</span>
        </a>
        <form className="identity-form" onSubmit={handleIdentitySubmit}>
          <label htmlFor="owner-id">Usuário</label>
          <input
            id="owner-id"
            value={ownerInput}
            maxLength={120}
            onChange={(event) => setOwnerInput(event.target.value)}
            aria-label="Identificador do usuário"
          />
          <button className="identity-submit" type="submit">Abrir</button>
        </form>
      </header>

      <main className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">ESPAÇO PESSOAL</p>
            <h1>Documentos</h1>
          </div>
          <span className="document-count" aria-live="polite">
            {documents.length} {documents.length === 1 ? 'arquivo' : 'arquivos'}
          </span>
        </div>

        <section className="upload-panel" aria-labelledby="upload-heading">
          <div className="upload-copy">
            <span className="upload-icon" aria-hidden="true">↑</span>
            <div>
              <h2 id="upload-heading">Adicionar documento</h2>
              <p>Os arquivos ficam armazenados neste dispositivo.</p>
            </div>
          </div>
          <form className="upload-form" onSubmit={handleUpload}>
            <label className="file-picker" htmlFor="document-file">
              <span>{selectedFile ? selectedFile.name : 'Escolher arquivo'}</span>
              <input
                ref={fileInput}
                id="document-file"
                type="file"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
            </label>
            <button className="upload-button" type="submit" disabled={uploading || !selectedFile}>
              {uploading ? 'Enviando...' : 'Enviar arquivo'}
            </button>
          </form>
        </section>

        {error && <p className="error-message" role="alert">{error}</p>}

        <section className="documents-section" aria-labelledby="documents-heading">
          <div className="section-heading">
            <h2 id="documents-heading">Seus arquivos</h2>
            <span>Ordenados pelos mais recentes</span>
          </div>

          {loading ? (
            <p className="list-message">Carregando documentos...</p>
          ) : documents.length === 0 ? (
            <div className="empty-state">
              <span className="empty-symbol" aria-hidden="true">—</span>
              <h3>Nenhum documento por aqui</h3>
              <p>Os arquivos enviados aparecerão nesta lista.</p>
            </div>
          ) : (
            <div className="document-list">
              {documents.map((document) => (
                <article className="document-row" key={document.id}>
                  <div className="file-type" aria-hidden="true">DOC</div>
                  <div className="document-details">
                    <h3 title={document.originalName}>{document.originalName}</h3>
                    <p>{formatFileSize(document.size)} <span aria-hidden="true">·</span> {formatDate(document.uploadedAt)}</p>
                  </div>
                  <button
                    className="download-button"
                    type="button"
                    title={`Baixar ${document.originalName}`}
                    aria-label={`Baixar ${document.originalName}`}
                    disabled={downloadingId === document.id}
                    onClick={() => handleDownload(document)}
                  >
                    {downloadingId === document.id ? 'Baixando...' : 'Baixar ↓'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="footer-note">ARQUIVO LOCAL <span>•</span> DOCUMENTOS DE {ownerId.toUpperCase()}</footer>
    </div>
  );
}