function createDocumentRepository() {
  const documents = new Map();

  function save(document) {
    documents.set(document.id, document);
  }

  function findByOwner(owner) {
    return [...documents.values()]
      .filter((document) => document.owner === owner)
      .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt));
  }

  function findByIdAndOwner(id, owner) {
    const document = documents.get(id);
    return document?.owner === owner ? document : null;
  }

  return { save, findByOwner, findByIdAndOwner };
}

module.exports = createDocumentRepository;