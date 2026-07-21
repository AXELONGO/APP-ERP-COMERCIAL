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

    // Clear columns A and C in Registro de Actividades
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Registro de Actividades!A:A',
    });
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Registro de Actividades!C:C',
    });

    // Re-write headers and formulas
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Registro de Actividades!A1:C2',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          ['ID Actividad', null, 'Semana'],
          [`=ARRAYFORMULA(IF(B2:B<>"", "ACT-" & TEXT(ROW(A2:A)-1, "000"), ""))`, null, `=ARRAYFORMULA(IF(B2:B<>"", "Semana " & ISOWEEKNUM(B2:B), ""))`]
        ]
      }
    });

    console.log('Forzadas formulas en Registro de Actividades');

    // Wait for Sheets to recalculate
    await new Promise(r => setTimeout(r, 2000));

    // Audit Tracker again
    const trackRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Tracker Semanal!A27:H28',
    });
    console.log('Tracker Semanal Semana 27:', trackRes.data.values);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
