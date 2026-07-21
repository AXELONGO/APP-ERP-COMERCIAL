const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const formulas = [
      { sheet: 'Prospectos', prefix: 'PRO-' },
      { sheet: 'Proyectos', prefix: 'PRJ-' },
      { sheet: 'Pipeline de Proyecto', prefix: 'PIP-' },
      { sheet: 'Tareas', prefix: 'TAR-' },
      { sheet: 'Clientes', prefix: 'CLI-' },
      { sheet: 'Citas', prefix: 'CIT-' },
      { sheet: 'Asesores', prefix: 'ASE-' }
    ];

    for (const f of formulas) {
      console.log('Fixing ' + f.sheet);
      
      // Clear column A from row 2 down
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${f.sheet}'!A2:A`,
      });
      
      // Update A2 with the correct array formula
      const formula = `=ARRAYFORMULA(IF(B2:B="","", "${f.prefix}" & TEXT(ROW(B2:B)-1,"000")))`;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${f.sheet}'!A2`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[formula]] }
      });
      
      console.log('Fixed ' + f.sheet);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
