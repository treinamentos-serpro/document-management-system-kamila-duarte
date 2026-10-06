function createDocumentController(documentService) {
  function requireOwner(req, res, next) {
    const ownerId = req.get('X-User-Id')?.trim();

    if (!ownerId || ownerId.length > 120) {
      return res.status(400).json({
        error: { code: 'INVALID_USER', message: 'O cabeçalho X-User-Id é obrigatório e deve ter até 120 caracteres.' },
      });
    }

    req.ownerId = ownerId;
    return next();
  }

  async function upload(req, res) {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'FILE_REQUIRED', message: 'Envie um arquivo no campo "file".' },
      });
    }

    const document = await documentService.uploadDocument(req.file, req.ownerId);
    return res.status(201).json(document);
  }

  function list(req, res) {
    return res.json({ documents: documentService.listDocuments(req.ownerId) });
  }

  function download(req, res, next) {
    const result = documentService.getDownload(req.params.id, req.ownerId);

    if (!result) {
      return res.status(404).json({
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
      });
    }

    return res.download(result.filePath, result.document.originalName, (error) => {
      if (error && !res.headersSent) {
        res.status(500).json({
          error: { code: 'DOWNLOAD_FAILED', message: 'Não foi possível baixar o documento.' },
        });
      } else if (error) {
        next(error);
      }
    });
  }

  return { requireOwner, upload, list, download };
}

module.exports = createDocumentController;