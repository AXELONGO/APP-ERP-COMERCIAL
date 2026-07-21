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

    // Debug: Get a row from Registro de Actividades
    const regRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Registro de Actividades!A1:E5',
    });
    console.log('Registro de Actividades:', regRes.data.values);

    // Get Tracker Semanal row 28 (Semana 27)
    const trackRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Tracker Semanal!A28:H28',
    });
    console.log('Tracker Semanal Semana 27:', trackRes.data.values);

    // Get Clientes headers to fix Dashboard sum
    const cliRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Clientes!A1:Z1',
    });
    let colIndex = cliRes.data.values[0].indexOf('Valor mensual');
    let colLetter = String.fromCharCode(65 + colIndex);
    console.log('Valor mensual column in Clientes is:', colLetter);

    // Fix the Dashboard formula
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dashboard!B7',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[`=SUM(Clientes!${colLetter}:${colLetter})`]] }
    });
    console.log('Fixed Dashboard formula for Ingresos Mensuales.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
