const express = require('express');
const path = require('node:path');
const documentRoutes = require('./routes/documentRoutes');
const createDocumentController = require('./controllers/documentController');
const createDocumentService = require('./services/documentService');
const createDocumentRepository = require('./repositories/documentRepository');
const createLocalFileRepository = require('./repositories/localFileRepository');

function createApp(options = {}) {
  const storageDirectory = path.resolve(
    options.storageDirectory || process.env.STORAGE_DIR || path.join(__dirname, '../storage'),
  );
  const maxFileSizeBytes = options.maxFileSizeBytes
    || Number.parseInt(process.env.MAX_FILE_SIZE_BYTES, 10)
    || 10 * 1024 * 1024;
  const documentRepository = createDocumentRepository();
  const fileRepository = createLocalFileRepository(storageDirectory);
  const documentService = createDocumentService(documentRepository, fileRepository);
  const documentController = createDocumentController(documentService);
  const app = express();

  app.use(express.json());
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/', documentRoutes(documentController, storageDirectory, maxFileSizeBytes));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE';
    const isUploadError = error.name === 'MulterError' || error.code?.startsWith('LIMIT_');
    const status = isFileTooLarge ? 413 : (isUploadError ? 400 : 500);
    const code = isFileTooLarge
      ? 'FILE_TOO_LARGE'
      : (isUploadError ? 'INVALID_UPLOAD' : 'INTERNAL_ERROR');
    const message = isFileTooLarge
      ? 'O arquivo excede o tamanho máximo permitido.'
      : (isUploadError ? 'Não foi possível processar o arquivo enviado.' : 'Ocorreu um erro interno.');

    res.status(status).json({ error: { code, message } });
  });

  return app;
}

const app = createApp();
app.createApp = createApp;

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT, 10) || 3000;
  app.listen(port, () => {
    console.log(`DMS backend ouvindo na porta ${port}`);
  });
}

module.exports = app;
