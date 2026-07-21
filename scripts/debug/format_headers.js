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

    const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const allSheets = response.data.sheets;
    
    let requests = [];

    for (let sheet of allSheets) {
      let sheetId = sheet.properties.sheetId;
      requests.push({
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1, // First row
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.1, green: 0.22, blue: 0.36 }, // Dark blue
              textFormat: {
                foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, // White text
                bold: true
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
        }
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests }
    });

    console.log('Formato aplicado a todas las cabeceras.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
