const fs = require('node:fs');
const path = require('node:path');

function createLocalFileRepository(storageDirectory) {
  function getExistingPath(storageName) {
    if (!storageName || path.basename(storageName) !== storageName) {
      return null;
    }

    const filePath = path.join(storageDirectory, storageName);
    return fs.existsSync(filePath) ? filePath : null;
  }

  async function remove(storageName) {
    if (!storageName || path.basename(storageName) !== storageName) {
      return;
    }

    await fs.promises.rm(path.join(storageDirectory, storageName), { force: true });
  }

  return { getExistingPath, remove };
}

module.exports = createLocalFileRepository;