const asyncHandler = require('../middleware/asyncHandler');
const { getSheets, getPublicData, findRowById, getSheetId, SPREADSHEET_ID } = require('../config/sheets');

const PREFIX_MAP = {
  'Clientes': 'CLI-',
  'Prospectos': 'PRO-',
  'Proyectos': 'PRJ-',
  'Pipeline de Proyecto': 'PIP-',
  'Tareas': 'TAR-',
  'Citas': 'CIT-',
  'Asesores': 'ASE-',
  'Actividades': 'ACT-'
};

function crudRoutes(app, sheetName, range, mapper, customEndpoint) {
  const endpoint = customEndpoint || sheetName.toLowerCase().replace(/ /g, '_');

  app.get(`/api/${endpoint}`, asyncHandler(async (req, res) => {
    const rows = await getPublicData(sheetName);
    res.json(rows);
  }));

  app.post(`/api/${endpoint}`, asyncHandler(async (req, res) => {
    const sheets = await getSheets();

    let nextId = '';
    const prefix = PREFIX_MAP[sheetName];
    if (prefix) {
      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A2:A`,
      });
      const existingData = getRes.data.values || [];
      const maxNum = existingData.reduce((max, row) => {
        const m = row[0] ? row[0].match(/\d+/) : null;
        return m ? Math.max(max, parseInt(m[0], 10)) : max;
      }, 0);
      nextId = `${prefix}${(maxNum + 1).toString().padStart(3, '0')}`;
    }

    const getRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${sheetName}'!A:A` });
    const numRows = (getRes.data.values || []).length;
    const nextRowNum = numRows + 1;

    const row = mapper(req.body, [nextId], [], nextRowNum);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:A`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });
    res.json({ success: true, id: nextId });
  }));

  app.put(`/api/${endpoint}/:id`, asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const rowNum = await findRowById(sheets, sheetName, req.params.id);
    if (rowNum === -1) return res.status(404).json({ error: 'Registro no encontrado' });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A${rowNum}:Z${rowNum}`,
    });
    const getFormulaRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A${rowNum}:Z${rowNum}`,
      valueRenderOption: 'FORMULA'
    });
    const existingRow = getRes.data.values ? getRes.data.values[0] : [];
    const existingFormulas = getFormulaRes.data.values ? getFormulaRes.data.values[0] : [];

    const row = mapper(req.body, existingRow, existingFormulas, rowNum);
    row[0] = req.params.id;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });
    res.json({ success: true });
  }));

  app.delete(`/api/${endpoint}/:id`, asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const rowNum = await findRowById(sheets, sheetName, req.params.id);
    if (rowNum === -1) return res.status(404).json({ error: 'Registro no encontrado' });
    const sheetId = await getSheetId(sheets, sheetName);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum }
          }
        }]
      }
    });
    res.json({ success: true });
  }));
}

module.exports = { crudRoutes };