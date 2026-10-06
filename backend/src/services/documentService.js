const { randomUUID } = require('node:crypto');

function createDocumentService(documentRepository, fileRepository) {
  async function uploadDocument(file, owner) {
    const document = {
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner,
      storageName: file.filename,
    };

    try {
      documentRepository.save(document);
      const { storageName, ...publicDocument } = document;
      return publicDocument;
    } catch (error) {
      await fileRepository.remove(file.filename);
      throw error;
    }
  }

  function listDocuments(owner) {
    return documentRepository.findByOwner(owner).map(({ storageName, ...document }) => document);
  }

  function getDownload(id, owner) {
    const document = documentRepository.findByIdAndOwner(id, owner);

    if (!document) {
      return null;
    }

    const filePath = fileRepository.getExistingPath(document.storageName);
    if (!filePath) {
      return null;
    }

    return { document, filePath };
  }

  return { uploadDocument, listDocuments, getDownload };
}

module.exports = createDocumentService;