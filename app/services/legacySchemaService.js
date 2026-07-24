const { getSheets, SPREADSHEET_ID } = require('../config/sheets');

function columnLetter(index) {
  let result = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function ensureProspectosGiroColumn() {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "'Prospectos'!A1:Z1"
  });
  const headers = response.data.values?.[0] || [];
  const existingIndex = headers.findIndex(header => String(header).trim().toLowerCase() === 'giro');
  if (existingIndex >= 0) return { created: false, column: columnLetter(existingIndex) };

  let lastHeaderIndex = headers.reduce((last, header, index) => String(header || '').trim() ? index : last, -1);
  if (lastHeaderIndex < 0) lastHeaderIndex = 0;
  const index = lastHeaderIndex + 1;
  const column = columnLetter(index);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'Prospectos'!${column}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Giro']] }
  });
  return { created: true, column };
}

module.exports = { ensureProspectosGiroColumn };
