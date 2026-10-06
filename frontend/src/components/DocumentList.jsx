import { useId } from 'react';
import DownloadButton from './DownloadButton.jsx';

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

export default function DocumentList({ documents, loading, downloadingId, onDownload }) {
  const headingId = useId();

  return (
    <section className="documents-section" aria-labelledby={headingId}>
      <div className="section-heading">
        <h2 id={headingId}>Seus arquivos</h2>
        <span>Ordenados pelos mais recentes</span>
      </div>
      {loading ? (
        <p className="list-message" role="status">Carregando documentos...</p>
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
              <DownloadButton
                document={document}
                downloading={downloadingId === document.id}
                onDownload={onDownload}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}