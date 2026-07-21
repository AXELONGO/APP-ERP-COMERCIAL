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

    console.log('--- INICIANDO AUDITORÍA AUTOMÁTICA ---\n');

    // 1. Auditar Dashboard
    console.log('📊 AUDITORÍA DEL DASHBOARD:');
    const dashResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dashboard!A2:B8',
    });
    
    if (dashResponse.data.values) {
      dashResponse.data.values.forEach(row => {
        console.log(`- ${row[0]}: ${row[1]}`);
      });
    } else {
      console.log('No se encontraron datos en el Dashboard.');
    }

    // 2. Auditar Tracker Semanal (Semana actual ~ Semana 27 o donde haya datos)
    console.log('\n📈 AUDITORÍA DEL TRACKER SEMANAL:');
    const trackerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Tracker Semanal!A1:H53',
    });

    let foundData = false;
    if (trackerResponse.data.values) {
      trackerResponse.data.values.forEach(row => {
        // Find rows where % is not #DIV/0! or 0.00% or where calls > 0
        if (row[2] && parseInt(row[2]) > 0) {
          console.log(`\nSemana con actividad detectada: ${row[0]}`);
          console.log(`- Lunes Operación: ${row[1]}`);
          console.log(`- Llamadas: ${row[2]}`);
          console.log(`- Creativos y Videos: ${row[3]}`);
          console.log(`- Videos Personales: ${row[4]}`);
          console.log(`- Kaizen: ${row[5]}`);
          console.log(`- Viernes Estrategia: ${row[6]}`);
          console.log(`- CUMPLIMIENTO TOTAL: ${row[7]}`);
          foundData = true;
        }
      });
    }
    if (!foundData) console.log('No se encontraron actividades registradas en el Tracker.');

    // 3. Auditar Autogeneración de IDs en Clientes
    console.log('\n🆔 AUDITORÍA DE IDs AUTOMÁTICOS (Muestra de Clientes):');
    const clientResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Clientes!A2:C4',
    });
    
    if (clientResponse.data.values) {
      clientResponse.data.values.forEach(row => {
        console.log(`- ID: ${row[0]} | Cliente: ${row[1]} | Correo: ${row[2]}`);
      });
    } else {
      console.log('No se encontraron clientes.');
    }

    console.log('\n--- AUDITORÍA FINALIZADA ---');

  } catch (error) {
    console.error('Error durante la auditoría:', error.message);
  }
}

main();
