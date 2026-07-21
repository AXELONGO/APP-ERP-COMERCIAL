const { google } = require('googleapis');
const path = require('path');
const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

const NUM_RECORDS = 60;
const names = ['Axel', 'Laura', 'Carlos', 'Ana', 'Luis', 'Sofia', 'Jorge', 'Marta', 'Brena', 'David'];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randArr = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randDate = () => `2026-07-${String(randInt(1, 28)).padStart(2, '0')}`;

async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    
    const rows = [];
    for (let i = 1; i <= NUM_RECORDS; i++) {
      rows.push([
        `CIT-${String(i+100).padStart(3, '0')}`, // ID Citas (0)
        'Reunión ' + i, // Nombre (1)
        randDate(), // Fecha de Registro (2)
        `cliente${i}@test.com`, // Correo (3)
        '555-000-' + randInt(1000, 9999), // Teléfono (4)
        randDate(), // Fecha de la Cita (5)
        `${String(randInt(9, 18)).padStart(2, '0')}:00`, // Hora de la Cita (6)
        'Notas de la cita ' + i, // Notas (7)
        'PRJ-' + String(randInt(100, 160)).padStart(3, '0'), // ID Proyecto (8)
        'CLI-' + String(randInt(100, 160)).padStart(3, '0'), // ID Cliente (9)
        randArr(['Kickoff', 'Diagnóstico', 'Seguimiento', 'Presentación', 'Reporte', 'Renovación']), // Tipo de reunión (10)
        randArr(names), // Responsable (11)
        'Pendiente', // Resultado (12)
        'Llamar de nuevo' // Próxima acción (13)
      ]);
    }
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Citas!A:N',
      valueInputOption: 'USER_ENTERED',
      resource: { values: rows }
    });
    console.log("Citas inyectadas con éxito!");
  } catch (e) {
    console.error(e);
  }
}
main();
