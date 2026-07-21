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

    // Clear the empty strings in columns A and C that are blocking the ARRAYFORMULA
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Registro de Actividades!A3:A1000',
    });
    
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Registro de Actividades!C3:C1000',
    });

    console.log('Cleared blocking strings in Registro de Actividades.');

    // Wait a second for formulas to recalculate
    await new Promise(r => setTimeout(r, 2000));

    // Fetch the Tracker Semanal again
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
