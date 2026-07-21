const asyncHandler = require('../middleware/asyncHandler');
const { getSheets, getPublicData, findRowById, getSheetId, SPREADSHEET_ID } = require('../config/sheets');
const { uploadFile, getFile, deleteFile } = require('../config/drive');

const SHEET_NAME = 'Facturas';
const PREFIX = 'FAC-';
const RANGE = 'A:J';

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = (row[i] || '').toString(); });
  return obj;
}

function registerFacturasRoutes(app) {
  // GET /api/facturas
  app.get('/api/facturas', asyncHandler(async (req, res) => {
    const data = await getPublicData(SHEET_NAME);
    res.json(data);
  }));

  // GET /api/facturas/:id
  app.get('/api/facturas/:id', asyncHandler(async (req, res) => {
    const data = await getPublicData(SHEET_NAME);
    const record = data.find(r => r['ID Factura'] === req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'No encontrada' });
    res.json(record);
  }));

  // POST /api/facturas
  app.post('/api/facturas', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const d = req.body;

    // Get last ID
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:A`,
    });
    const ids = (getRes.data.values || []).flat().filter(Boolean);
    let nextNum = 1;
    ids.forEach(id => {
      const match = id.match(/FAC-(\d+)/);
      if (match) nextNum = Math.max(nextNum, parseInt(match[1]) + 1);
    });
    const newId = `${PREFIX}${String(nextNum).padStart(3, '0')}`;

    const row = [
      newId,
      d.cliente || '',
      d.fecha || new Date().toISOString().split('T')[0],
      d.vencimiento || '',
      d.concepto || '',
      d.monto || '0',
      d.impuesto || '0',
      d.total || '0',
      d.estado || 'Emitida',
      d.notas || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    res.json({ success: true, id: newId });
  }));

  // PUT /api/facturas/:id
  app.put('/api/facturas/:id', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const d = req.body;

    const rowNum = await findRowById(sheets, SHEET_NAME, req.params.id);
    if (rowNum === -1) return res.status(404).json({ success: false, error: 'No encontrada' });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!${RANGE}`,
    });
    const headers = (getRes.data.values || [])[0] || [];
    const existing = (getRes.data.values || [])[rowNum - 1] || [];

    const fieldMap = {
      cliente: 1, fecha: 2, vencimiento: 3, concepto: 4,
      monto: 5, impuesto: 6, total: 7, estado: 8, notas: 9,
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

  // DELETE /api/facturas/:id
  app.delete('/api/facturas/:id', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const sheetId = await getSheetId(sheets, SHEET_NAME);

    const rowNum = await findRowById(sheets, SHEET_NAME, req.params.id);
    if (rowNum === -1) return res.status(404).json({ success: false, error: 'No encontrada' });

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

  // POST /api/facturas/:id/pdf — upload PDF to Google Drive
  app.post('/api/facturas/:id/pdf', asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, error: 'No se envió ningún archivo' });
    }
    const file = req.files.file;
    const driveFile = await uploadFile(file.data, `Factura_${id}.pdf`, file.mimetype || 'application/pdf');

    // Save Drive file ID to sheet
    const sheets = await getSheets();
    const rowNum = await findRowById(sheets, SHEET_NAME, id);
    if (rowNum !== -1) {
      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A${rowNum}:J${rowNum}`,
      });
      const existing = (getRes.data.values || [])[0] || [];
      existing[10] = driveFile.id; // column K: Drive File ID
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A${rowNum}:K${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [existing] },
      });
    }

    res.json({ success: true, driveFile });
  }));

  // GET /api/facturas/:id/pdf — redirect to Google Drive view
  app.get('/api/facturas/:id/pdf', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const rowNum = await findRowById(sheets, SHEET_NAME, req.params.id);
    if (rowNum === -1) return res.status(404).json({ success: false, error: 'No encontrada' });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A${rowNum}:K${rowNum}`,
    });
    const row = (getRes.data.values || [])[0] || [];
    const driveFileId = row[10];
    if (!driveFileId) return res.status(404).json({ success: false, error: 'Sin PDF asociado' });

    const fileData = await getFile(driveFileId);
    res.redirect(fileData.webViewLink);
  }));
}

module.exports = { registerFacturasRoutes };