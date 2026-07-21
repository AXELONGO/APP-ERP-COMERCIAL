const { google } = require('googleapis');
const path = require('path');

// Reemplaza con el ID real de tu hoja que me pasaste
const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

async function main() {
  try {
    // 1. Configurar la autenticación
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    console.log('Conectando a Google Sheets...');

    // 2. Leer información básica para comprobar la conexión (Opcional)
    const getRows = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A:A', // Ajusta esto según el nombre de tu pestaña, ej: 'Hoja 1!A:A'
    });
    console.log('Filas actuales en la columna A:', getRows.data.values ? getRows.data.values.length : 0);

    // 3. Escribir una fila de prueba en la hoja
    const testData = [['Prueba de conexión', 'Éxito', new Date().toLocaleString()]];
    
    console.log('Agregando una fila de prueba...');
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A:C', // Rango donde queremos agregar los datos
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: testData,
      },
    });

    console.log('¡Éxito! Se actualizaron', result.data.updates.updatedCells, 'celdas.');
    console.log('Revisa tu Google Sheet, deberías ver una nueva fila.');

  } catch (error) {
    console.error('Error al conectarse o modificar la hoja:', error.message);
  }
}

main();
