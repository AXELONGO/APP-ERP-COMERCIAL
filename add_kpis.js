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

    const kpiData = [
      ['RUTINA Y METAS SEMANALES', 'OBJETIVO', 'ESTADO'],
      ['Lunes', 'Operación (clientes y reuniones)', ''],
      ['Todos los días', 'Realizar 300 llamadas de prospección', ''],
      ['Agencia (Semanal)', 'Producir 6 creativos y 1 video', ''],
      ['Marca Personal (Semanal)', 'Publicar 6 videos', ''],
      ['Kaizen (Semanal)', 'Implementar o documentar 1 mejora del negocio', ''],
      ['Viernes', 'Crecimiento creativo y estrategia de negocio', '']
    ];

    console.log('Agregando Rutinas y Metas al Dashboard...');

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dashboard!D1:F7',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: kpiData
      }
    });

    console.log('¡Indicadores semanales agregados al Dashboard con éxito!');
  } catch (error) {
    console.error('Error agregando los indicadores:', error.message);
  }
}

main();
