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

    // 1. Add "Registro de Actividades" sheet
    console.log("Creando hoja de Registro de Actividades...");
    
    // First, let's get existing sheets to make sure it doesn't already exist and to get Tracker Semanal ID
    let response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    let existingTitles = response.data.sheets.map(s => s.properties.title);
    
    let batchRequests = [];
    if (!existingTitles.includes('Registro de Actividades')) {
      batchRequests.push({
        addSheet: { properties: { title: 'Registro de Actividades' } }
      });
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: batchRequests }
      });
      console.log("Hoja 'Registro de Actividades' creada.");
    } else {
      console.log("Hoja 'Registro de Actividades' ya existe.");
    }

    // Get sheet IDs
    response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    let registroSheetId = response.data.sheets.find(s => s.properties.title === 'Registro de Actividades').properties.sheetId;

    // 2. Prepare headers for Registro de Actividades
    const registroHeaders = [
      'ID Actividad', 'Fecha', 'Semana', 'Tipo de Indicador', 'Cantidad', 'ID Relacionado', 'Responsable', 'Evidencia / Notas'
    ];
    const registroFormulas = [
      `=ARRAYFORMULA(IF(B2:B<>"", "ACT-" & TEXT(ROW(A2:A)-1, "000"), ""))`, // A2
      '', // B2
      `=ARRAYFORMULA(IF(B2:B<>"", "Semana " & ISOWEEKNUM(B2:B), ""))` // C2
    ];

    // 3. Prepare Tracker Semanal updates
    let trackerValues = [
      [
        'Semana',
        'Lunes: Operación (✅)',
        'Diario: Llamadas (Suma)',
        'Agencia: C+V (Suma)',
        'Personal: Videos (Suma)',
        'Kaizen: Mejora (✅)',
        'Viernes: Estrategia (✅)',
        '% Cumplimiento Semanal'
      ]
    ];

    for (let i = 1; i <= 52; i++) {
      let rowNum = i + 1;
      trackerValues.push([
        `Semana ${i}`,
        `=IF(COUNTIFS('Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Lunes Operación") > 0, "✅", "❌")`,
        `=SUMIFS('Registro de Actividades'!E:E, 'Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Llamadas")`,
        `=SUMIFS('Registro de Actividades'!E:E, 'Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Agencia Creativo") & " C, " & SUMIFS('Registro de Actividades'!E:E, 'Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Agencia Video") & " V"`,
        `=SUMIFS('Registro de Actividades'!E:E, 'Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Personal Video")`,
        `=IF(COUNTIFS('Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Kaizen") > 0, "✅", "❌")`,
        `=IF(COUNTIFS('Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Viernes Estrategia") > 0, "✅", "❌")`,
        `=( (IF(B${rowNum}="✅",1,0)) + (IF(C${rowNum}>=1500,1,0)) + (IF(AND(SUMIFS('Registro de Actividades'!E:E, 'Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Agencia Creativo")>=6, SUMIFS('Registro de Actividades'!E:E, 'Registro de Actividades'!C:C, A${rowNum}, 'Registro de Actividades'!D:D, "Agencia Video")>=1),1,0)) + (IF(E${rowNum}>=6,1,0)) + (IF(F${rowNum}="✅",1,0)) + (IF(G${rowNum}="✅",1,0)) ) / 6`
      ]);
    }

    // 4. Send Values Updates
    console.log("Escribiendo fórmulas...");
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: "'Registro de Actividades'!A1:H1",
            values: [registroHeaders]
          },
          {
            range: "'Registro de Actividades'!A2:C2",
            values: [registroFormulas]
          },
          {
            range: "'Tracker Semanal'!A1:H53",
            values: trackerValues
          }
        ]
      }
    });

    // 5. Setup Data Validation for Registro de Actividades
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId: registroSheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: 3,
                endColumnIndex: 4 // Column D
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: [
                    { userEnteredValue: 'Llamadas' },
                    { userEnteredValue: 'Agencia Creativo' },
                    { userEnteredValue: 'Agencia Video' },
                    { userEnteredValue: 'Personal Video' },
                    { userEnteredValue: 'Kaizen' },
                    { userEnteredValue: 'Lunes Operación' },
                    { userEnteredValue: 'Viernes Estrategia' }
                  ]
                },
                showCustomUi: true,
                strict: true
              }
            }
          }
        ]
      }
    });

    console.log("¡Actualización completada!");
  } catch (error) {
    console.error('Error aplicando los cambios relacionales:', error.message);
  }
}

main();
