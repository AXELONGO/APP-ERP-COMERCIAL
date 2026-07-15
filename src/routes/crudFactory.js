const { getSheets } = require('../config/sheets');
const sheetsService = require('../services/sheetsService');
const env = require('../config/env');
const constants = require('../config/constants');
const asyncHandler = require('../middleware/asyncHandler');
const { sanitizeInput } = require('../middleware/sanitize');
const cache = require('../services/cacheService');
const { notifyEvent } = require('../services/notificationService');

function crudRoutes(router, sheetName, range, mapper, endpoint) {

  router.get(`/${endpoint}`, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 0;
    const rows = await sheetsService.getPublicData(sheetName, { page, pageSize });
    res.json(rows);
  }));

  router.post(`/${endpoint}`, sanitizeInput, asyncHandler(async (req, res) => {
    const sheets = await getSheets();

    let nextId = '';
    const prefix = constants.PREFIX_MAP[sheetName];
    if (prefix) {
      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: env.SPREADSHEET_ID,
        range: `'${sheetName}'!A2:A`,
      });
      const existingData = getRes.data.values || [];
      const maxNum = existingData.reduce((max, row) => {
        const m = row[0] ? row[0].match(/\d+/) : null;
        return m ? Math.max(max, parseInt(m[0], 10)) : max;
      }, 0);
      nextId = `${prefix}${(maxNum + 1).toString().padStart(3, '0')}`;
    }

    const row = mapper(req.body, [nextId]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SPREADSHEET_ID,
      range: `'${sheetName}'!A:A`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });

    const nombre = req.body['Nombre'] || req.body['Nombre del Contacto'] || req.body['Nombre del Cliente'] || req.body['Nombre del Proyecto'] || req.body['Tarea'] || 'Registro';

    notifyEvent('CREATE', sheetName, nextId, {
      nombre,
      registradoPor: req.body['Asesor'] || req.body['Responsable'] || 'Sistema'
    });

    await cache.del('sheet_' + sheetName);
    res.json({ success: true, message: 'Registro creado exitosamente', id: nextId });
  }));

  router.put(`/${endpoint}/:id`, sanitizeInput, asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const rowNum = await sheetsService.findRowById(sheets, sheetName, req.params.id);
    if (rowNum === -1) return res.status(404).json({ error: 'Registro no encontrado' });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range: `'${sheetName}'!A${rowNum}:${range.split(':')[1]}${rowNum}`,
      valueRenderOption: 'FORMULA',
    });
    const existingRow = getRes.data.values ? getRes.data.values[0] : [];
    if (existingRow.length > 0) existingRow[0] = req.params.id;
    else existingRow.push(req.params.id);

    const row = mapper(req.body, existingRow, [], rowNum);

    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SPREADSHEET_ID,
      range: `'${sheetName}'!A${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });

    await cache.del('sheet_' + sheetName);
    res.json({ success: true, message: 'Registro actualizado' });
  }));

  router.delete(`/${endpoint}/:id`, asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const sheetId = await sheetsService.getSheetId(sheets, sheetName);
    if (sheetId === null) return res.status(500).json({ error: 'No se pudo obtener el ID de la hoja' });

    const rowNum = await sheetsService.findRowById(sheets, sheetName, req.params.id);
    if (rowNum === -1) return res.status(404).json({ error: 'Registro no encontrado' });

    const deleteRequest = {
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: rowNum - 1,
          endIndex: rowNum
        }
      }
    };

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.SPREADSHEET_ID,
      resource: { requests: [deleteRequest] },
    });

    await cache.del('sheet_' + sheetName);
    res.json({ success: true, message: 'Registro eliminado' });
  }));

}

module.exports = crudRoutes;
