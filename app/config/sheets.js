const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

async function getSheets() {
  let authOptions = {
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  };

  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      let rawCreds = process.env.GOOGLE_CREDENTIALS.trim();
      let isBase64 = false;

      if (!rawCreds.startsWith('{') && !rawCreds.startsWith('"') && !rawCreds.startsWith('\\{')) {
        try {
          rawCreds = Buffer.from(rawCreds, 'base64').toString('utf-8');
          isBase64 = true;
        } catch (err) {}
      }

      if (!isBase64) {
        if (rawCreds.startsWith('"') && rawCreds.endsWith('"')) {
          rawCreds = rawCreds.slice(1, -1);
        }
        rawCreds = rawCreds.replace(/\\"/g, '"').replace(/\\\\n/g, '\\n').replace(/\\{/g, '{').replace(/\\}/g, '}');
      }

      authOptions.credentials = typeof rawCreds === 'string' ? JSON.parse(rawCreds) : rawCreds;
    } catch (e) {
      throw new Error(`[AUTH] Error crítico parseando GOOGLE_CREDENTIALS: ${e.message}`);
    }
  } else {
    if (!fs.existsSync(path.join(__dirname, '../../credentials.json'))) {
      throw new Error('[AUTH] credentials.json NO ENCONTRADO');
    }
    authOptions.keyFile = path.join(__dirname, '../../credentials.json');
  }

  const auth = new google.auth.GoogleAuth(authOptions);
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function getPublicData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();
  const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)[1];
  const data = JSON.parse(jsonString);

  const headers = data.table.cols.map(c => c.label || '');

  return (data.table.rows || [])
    .filter(r => r.c && r.c.some(cell => cell && cell.v !== null && cell.v !== undefined && cell.v !== ''))
    .map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = r.c[i] ? (r.c[i].f !== undefined ? r.c[i].f : r.c[i].v) : '';
      if (val === null) val = '';
      obj[h] = String(val);
    });
    return obj;
  });
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
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:A`,
  });
  const vals = r.data.values || [];
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0] === id) return i + 1;
  }
  return -1;
}

async function getSheetId(sheets, title) {
  const r = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = r.data.sheets.find(s => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}

module.exports = { getSheets, getPublicData, toRows, findRowById, getSheetId, SPREADSHEET_ID };