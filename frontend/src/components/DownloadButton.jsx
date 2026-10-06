export default function DownloadButton({ document, downloading, onDownload }) {
  return (
    <button
      className="download-button"
      type="button"
      title={`Baixar ${document.originalName}`}
      aria-label={`Baixar ${document.originalName}`}
      disabled={downloading}
      onClick={() => onDownload(document)}
    >
      {downloading ? 'Baixando...' : 'Baixar ↓'}
    </button>
  );
}