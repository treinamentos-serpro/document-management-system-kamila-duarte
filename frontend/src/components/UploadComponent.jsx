import { useId, useRef, useState } from 'react';

export default function UploadComponent({ onUpload, uploading }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInput = useRef(null);
  const inputId = useId();
  const headingId = useId();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedFile || uploading) return;

    const succeeded = await onUpload(selectedFile);
    if (succeeded) {
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section className="upload-panel" aria-labelledby={headingId}>
      <div className="upload-copy">
        <span className="upload-icon" aria-hidden="true">↑</span>
        <div>
          <h2 id={headingId}>Adicionar documento</h2>
          <p>Os arquivos ficam armazenados no servidor local.</p>
        </div>
      </div>
      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="file-picker" htmlFor={inputId}>
          <span>{selectedFile ? selectedFile.name : 'Escolher arquivo'}</span>
          <input
            ref={fileInput}
            id={inputId}
            type="file"
            disabled={uploading}
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          />
        </label>
        <button className="upload-button" type="submit" disabled={uploading || !selectedFile}>
          {uploading ? 'Enviando...' : 'Enviar arquivo'}
        </button>
      </form>
    </section>
  );
}