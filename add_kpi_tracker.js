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

    // 1. Add New Sheet "Tracker Semanal"
    const addSheetResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: 'Tracker Semanal' }
            }
          }
        ]
      }
    });

    // Get the sheetId of the newly created sheet
    const sheetId = addSheetResponse.data.replies[0].addSheet.properties.sheetId;

    // 2. Prepare Data (Headers + 52 Weeks)
    const values = [
      [
        'Semana',
        'Lunes: Operación',
        'Diario: 300 Llamadas',
        'Agencia: 6 Creativos, 1 Video',
        'Personal: 6 Videos',
        'Kaizen: 1 Mejora',
        'Viernes: Crecimiento',
        '% Cumplimiento'
      ]
    ];

    for (let i = 1; i <= 52; i++) {
      values.push([
        `Semana ${i}`,
        'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', // Checkboxes default text representation
        `=COUNTIF(B${i+1}:G${i+1}, TRUE)/6` // Formula for percentage
      ]);
    }

    // 3. Write Data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Tracker Semanal!A1:H53',
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    // 4. Apply Checkboxes (Data Validation) & Formatting
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 53,
                startColumnIndex: 1,
                endColumnIndex: 7
              },
              rule: {
                condition: { type: 'BOOLEAN' },
                showCustomUi: true
              }
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 53,
                startColumnIndex: 7,
                endColumnIndex: 8 // Column H (percentage)
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: 'PERCENT', pattern: '0.00%' }
                }
              },
              fields: 'userEnteredFormat.numberFormat'
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 8 // Headers bold
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)'
            }
          }
        ]
      }
    });

    console.log('¡Tabla de Tracker Semanal creada con éxito!');
  } catch (error) {
    console.error('Error creando el tracker:', error.message);
  }
}

main();
