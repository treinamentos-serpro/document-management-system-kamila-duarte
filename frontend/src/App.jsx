import { useEffect, useState } from 'react';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';
import { downloadDocument, listDocuments, uploadDocument } from './services/documents.js';
import './styles.css';

export default function App() {
  const [ownerId, setOwnerId] = useState('demo-user');
  const [ownerInput, setOwnerInput] = useState('demo-user');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    const abortController = new AbortController();

    setLoading(true);
    setDocuments([]);
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
    if (uploading || downloadingId) return;
    const nextOwner = ownerInput.trim();
    if (!nextOwner) {
      setError('Informe um identificador de usuário.');
      return;
    }
    setOwnerId(nextOwner);
  }

  async function handleUpload(file) {
    setUploading(true);
    setError('');
    try {
      await uploadDocument(ownerId, file);
      const result = await listDocuments(ownerId);
      setDocuments(result.documents);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
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
            disabled={uploading || downloadingId !== null}
            onChange={(event) => setOwnerInput(event.target.value)}
            aria-label="Identificador do usuário"
          />
          <button className="identity-submit" type="submit" disabled={uploading || downloadingId !== null}>Abrir</button>
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

        <UploadComponent key={ownerId} onUpload={handleUpload} uploading={uploading} />

        {error && <p className="error-message" role="alert">{error}</p>}

        <DocumentList
          documents={documents}
          loading={loading}
          downloadingId={downloadingId}
          onDownload={handleDownload}
        />
      </main>
      <footer className="footer-note">ARQUIVO LOCAL <span>•</span> DOCUMENTOS DE {ownerId.toUpperCase()}</footer>
    </div>
  );
}