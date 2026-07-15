const cache = require('./cacheService');
const env = require('../config/env');
const { getSheets } = require('../config/sheets');

async function getPublicData(sheetName, options = {}) {
  const { page = 1, pageSize = 0 } = options;
  const cacheKey = `sheet_${sheetName}`;
  const cachedData = await cache.get(cacheKey);

  let allData;
  if (cachedData) {
    allData = cachedData;
  } else {
    try {
      const sheets = await getSheets();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: env.SPREADSHEET_ID,
        range: `'${sheetName}'`,
      });

      const values = response.data.values || [];
      if (values.length === 0) {
        allData = [];
      } else {
        const headers = values[0];
        const rows = values.slice(1).map((r, idx) => {
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = r[i] !== undefined ? String(r[i]) : '';
          });
          obj._rowIndex = idx + 2;
          return obj;
        });
        allData = rows;
      }
      await cache.set(cacheKey, allData);
    } catch (error) {
      const { reportBug } = require('./notificationService');
      await reportBug(`Error leyendo la hoja "${sheetName}" desde Google Sheets`, { error: error.message, stack: error.stack });
      console.error(`Error fetching sheet ${sheetName}:`, error);
      return [];
    }
  }

  if (pageSize > 0 && Array.isArray(allData)) {
    const start = (page - 1) * pageSize;
    const paginated = allData.slice(start, start + pageSize);
    return {
      data: paginated,
      total: allData.length,
      page,
      pageSize,
      totalPages: Math.ceil(allData.length / pageSize)
    };
  }

  return allData;
}

function toRows(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, i) => {
    const obj = { _rowIndex: i + 2 };
    headers.forEach((h, j) => { obj[h] = row[j] || ''; });
    return obj;
  });
}

async function findRowById(sheets, sheetName, id) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SPREADSHEET_ID,
    range: `'${sheetName}'!A:A`,
  });
  const vals = r.data.values || [];
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0] === id) return i + 1;
  }
  return -1;
}

async function getSheetId(sheets, title) {
  const r = await sheets.spreadsheets.get({ spreadsheetId: env.SPREADSHEET_ID });
  const sheet = r.data.sheets.find(s => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}

module.exports = {
  getPublicData,
  toRows,
  findRowById,
  getSheetId
};
