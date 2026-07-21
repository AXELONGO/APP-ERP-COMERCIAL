const asyncHandler = require('../middleware/asyncHandler');
const { getSheets, getPublicData, findRowById, getSheetId, SPREADSHEET_ID } = require('../config/sheets');
const { uploadFile, getFile, listFiles, deleteFile, getDrive } = require('../config/drive');

const SHEET_NAME = 'Archivos';
const PREFIX = 'ARC-';

const MIME_TYPES = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Imagen',
  'image/png': 'Imagen',
  'image/gif': 'Imagen',
  'image/webp': 'Imagen',
  'application/msword': 'Documento',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento',
  'application/vnd.ms-excel': 'Hoja de Cálculo',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Hoja de Cálculo',
  'text/plain': 'Texto',
  'application/zip': 'Comprimido',
};

function getFileCategory(mimeType) {
  return MIME_TYPES[mimeType] || 'Otro';
}

function formatSize(bytes) {
  if (!bytes) return '—';
  const b = parseInt(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function registerArchivosRoutes(app) {
  // GET /api/archivos/drive-status
  app.get('/api/archivos/drive-status', asyncHandler(async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const tokenFile = path.join(__dirname, '../../drive-token.json');

    // Only consider connected if OAuth token exists (service account lacks Drive quota)
    if (fs.existsSync(tokenFile)) {
      try {
        await getDrive();
        res.json({ connected: true, method: 'oauth' });
        return;
      } catch (e) {}
    }

    res.json({
      connected: false,
      method: 'none',
      authUrl: '/api/auth/google',
      message: 'Google Drive necesita autorización. Haz clic en "Autorizar Drive" para conectar tu cuenta.',
    });
  }));

  // GET /api/archivos
  app.get('/api/archivos', asyncHandler(async (req, res) => {
    const data = await getPublicData(SHEET_NAME);
    // Enrich with Drive info for files that have a driveFileId
    const enriched = await Promise.all(data.map(async (r) => {
      if (r['Drive File ID']) {
        try {
          const driveInfo = await getFile(r['Drive File ID']);
          r.webViewLink = driveInfo.webViewLink;
          r.webContentLink = driveInfo.webContentLink;
        } catch (e) {
          // Drive file might have been deleted
        }
      }
      return r;
    }));
    res.json(enriched);
  }));

  // GET /api/archivos/:id
  app.get('/api/archivos/:id', asyncHandler(async (req, res) => {
    const data = await getPublicData(SHEET_NAME);
    const record = data.find(r => r['ID Archivo'] === req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'No encontrado' });
    if (record['Drive File ID']) {
      try {
        const driveInfo = await getFile(record['Drive File ID']);
        record.webViewLink = driveInfo.webViewLink;
        record.webContentLink = driveInfo.webContentLink;
      } catch (e) {}
    }
    res.json(record);
  }));

  // POST /api/archivos/upload — upload file to Google Drive
  app.post('/api/archivos/upload', asyncHandler(async (req, res) => {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, error: 'No se envió ningún archivo' });
    }

    const file = req.files.file;
    const sheets = await getSheets();

    // Get last ID
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:A`,
    });
    const ids = (getRes.data.values || []).flat().filter(Boolean);
    let nextNum = 1;
    ids.forEach(id => {
      const match = id.match(/ARC-(\d+)/);
      if (match) nextNum = Math.max(nextNum, parseInt(match[1]) + 1);
    });
    const newId = `${PREFIX}${String(nextNum).padStart(3, '0')}`;

    // Upload to Google Drive
    const driveFile = await uploadFile(file.data, file.name, file.mimetype);
    const fileSize = formatSize(driveFile.size);
    const category = getFileCategory(file.mimetype);

    // Save metadata in Sheets
    const row = [
      newId,
      file.name,
      category,
      fileSize,
      driveFile.id,
      driveFile.webViewLink || '',
      new Date().toISOString().split('T')[0],
      req.body.proyecto || '',
      req.body.cliente || '',
      req.body.notas || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    res.json({
      success: true,
      id: newId,
      driveFile: {
        id: driveFile.id,
        name: driveFile.name,
        webViewLink: driveFile.webViewLink,
        webContentLink: driveFile.webContentLink,
      },
    });
  }));

  // PUT /api/archivos/:id — update metadata
  app.put('/api/archivos/:id', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const d = req.body;

    const rowNum = await findRowById(sheets, SHEET_NAME, req.params.id);
    if (rowNum === -1) return res.status(404).json({ success: false, error: 'No encontrado' });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:J`,
    });
    const existing = (getRes.data.values || [])[rowNum - 1] || [];

    const fieldMap = {
      notas: 9, proyecto: 7, cliente: 8,
    };

    for (const [key, idx] of Object.entries(fieldMap)) {
      if (d[key] !== undefined) existing[idx] = String(d[key]);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A${rowNum}:J${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [existing] },
    });

    res.json({ success: true });
  }));

  // DELETE /api/archivos/:id — delete from Drive + Sheets
  app.delete('/api/archivos/:id', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const sheetId = await getSheetId(sheets, SHEET_NAME);

    const rowNum = await findRowById(sheets, SHEET_NAME, req.params.id);
    if (rowNum === -1) return res.status(404).json({ success: false, error: 'No encontrado' });

    // Get Drive file ID before deleting
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A${rowNum}:J${rowNum}`,
    });
    const row = (getRes.data.values || [])[0] || [];
    const driveFileId = row[4];

    // Delete from Drive if exists
    if (driveFileId) {
      try { await deleteFile(driveFileId); } catch (e) {}
    }

    // Delete row from Sheets
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
          },
        }],
      },
    });

    res.json({ success: true });
  }));
}

module.exports = { registerArchivosRoutes };