const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Get all sheet names
    const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetNames = response.data.sheets.map(s => s.properties.title);
    
    console.log('=== HOJAS EXISTENTES ===');
    console.log(sheetNames.join(', '));

    // Read headers and first 3 rows of each sheet
    const ranges = sheetNames.map(name => `'${name}'!1:3`);
    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges,
    });

    console.log('\n=== ESTRUCTURA DETALLADA ===');
    batchRes.data.valueRanges.forEach((vr, i) => {
      const title = sheetNames[i];
      const rows = vr.values || [];
      const headers = rows[0] || [];
      const row2 = rows[1] || [];
      const row3 = rows[2] || [];
      console.log(`\n--- ${title} ---`);
      console.log(`Columnas (${headers.length}): ${JSON.stringify(headers)}`);
      console.log(`Fila 2 (muestra): ${JSON.stringify(row2)}`);
      console.log(`Fila 3 (muestra): ${JSON.stringify(row3)}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
