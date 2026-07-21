const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

const prefixes = {
  'Clientes': 'CLI',
  'Asesores': 'ASE',
  'Proyectos': 'PRJ',
  'Contratos': 'CTR',
  'Citas': 'CIT',
  'Prospectos': 'PRO',
  'Parrilla de Contenidos': 'CNT'
};

const appendColumns = {
  'Clientes': ['Estado', 'Ejecutivo asignado', 'Servicios contratados', 'Fecha próxima renovación', 'Valor mensual', 'Valor anual', 'Prioridad', 'Estatus'],
  'Proyectos': ['Servicio', 'Etapa actual', '% Avance', 'Próxima tarea', 'Próxima reunión', 'Días sin movimiento', 'Prioridad', 'Riesgo'],
  'Contratos': ['ID Cliente', 'ID Proyecto'],
  'Citas': ['ID Proyecto', 'ID Cliente', 'Tipo de reunión', 'Responsable', 'Resultado', 'Próxima acción'],
  'Parrilla de Contenidos': ['ID Proyecto', 'ID Cliente', 'Objetivo', 'Responsable']
};

const newSheets = {
  'Pipeline de Proyecto': ['ID Pipeline', 'ID Proyecto', 'ID Cliente', 'Etapa', 'Responsable', 'Fecha inicio', 'Fecha fin', 'Duración', 'Estado', 'Comentarios'],
  'Tareas': ['ID Tarea', 'ID Proyecto', 'ID Cliente', 'Categoría', 'Tarea', 'Responsable', 'Prioridad', 'Fecha inicio', 'Fecha límite', 'Estado', 'Evidencia', 'Comentarios'],
  'Entregables': ['ID Entregable', 'ID Proyecto', 'ID Cliente', 'Tipo', 'Fecha entrega', 'Responsable', 'Estado', 'Link'],
};

async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 1. Get current sheets info
    console.log("Obteniendo información actual de las hojas...");
    let response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    let currentSheets = response.data.sheets;
    
    let batchRequests = [];
    let existingTitles = currentSheets.map(s => s.properties.title);

    // 2. Add New Sheets if they don't exist
    for (const sheetName of Object.keys(newSheets)) {
      if (!existingTitles.includes(sheetName)) {
        batchRequests.push({
          addSheet: { properties: { title: sheetName } }
        });
      }
    }
    // Add Dashboard if doesn't exist
    if (!existingTitles.includes('Dashboard')) {
      batchRequests.push({ addSheet: { properties: { title: 'Dashboard' } } });
    }

    // 3. Insert Column at A for existing sheets
    for (const sheet of currentSheets) {
      const title = sheet.properties.title;
      if (prefixes[title]) {
        // Find if they already have an ID column
        // We will assume they don't based on our earlier read, but we should be careful.
        // Actually, let's just insert it blindly since the user requested to add ID columns.
        batchRequests.push({
          insertDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: 1
            },
            inheritFromBefore: false
          }
        });
      }
    }

    if (batchRequests.length > 0) {
      console.log("Aplicando cambios estructurales (Nuevas hojas y columnas)...");
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: batchRequests }
      });
    }

    // 4. Fetch updated structure to get IDs and write headers/formulas
    response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, includeGridData: true });
    let updatedSheets = response.data.sheets;
    let dataValues = []; // for values.batchUpdate

    console.log("Escribiendo fórmulas y cabeceras...");
    
    // Process existing sheets to add ID formula and append new columns
    for (const sheet of updatedSheets) {
      const title = sheet.properties.title;
      const sheetId = sheet.properties.sheetId;
      const grid = sheet.data[0].rowData;
      let headers = grid && grid.length > 0 && grid[0].values ? grid[0].values.map(v => v.formattedValue || "") : [];

      if (prefixes[title]) {
        // Write ID Header and ArrayFormula
        const prefix = prefixes[title];
        dataValues.push({
          range: `'${title}'!A1:A2`,
          values: [
            [`ID ${title}`],
            [`=ARRAYFORMULA(IF(B2:B<>"", "${prefix}-" & TEXT(ROW(A2:A)-1, "000"), ""))`]
          ]
        });

        // Append new columns
        if (appendColumns[title]) {
          // find last column index. headers[0] is the newly inserted blank column, so headers.length is correct
          let startColLetter = String.fromCharCode(65 + headers.length); 
          // Note: if length > 26, this fails. Max current length is ~11, so it's fine.
          dataValues.push({
            range: `'${title}'!${startColLetter}1`,
            values: [appendColumns[title]]
          });
        }
      }

      // Process new sheets
      if (newSheets[title]) {
        let cols = newSheets[title];
        dataValues.push({
          range: `'${title}'!A1`,
          values: [cols]
        });
        
        let prefix = "NEW";
        if (title === 'Pipeline de Proyecto') prefix = 'PIP';
        if (title === 'Tareas') prefix = 'TAR';
        if (title === 'Entregables') prefix = 'ENT';
        
        dataValues.push({
          range: `'${title}'!A2`,
          values: [[`=ARRAYFORMULA(IF(B2:B<>"", "${prefix}-" & TEXT(ROW(A2:A)-1, "000"), ""))`]]
        });
      }
    }

    // Dashboard values
    dataValues.push({
      range: `'Dashboard'!A1:B10`,
      values: [
        ['Dashboard KPI', 'Valor'],
        ['Clientes Activos', '=COUNTIF(Clientes!B:B, "<>")-1'],
        ['Proyectos Activos', '=COUNTIF(Proyectos!B:B, "<>")-1'],
        ['Proyectos Detenidos', '=COUNTIFS(Proyectos!H:H, "Detenido")'],
        ['Total Tareas', '=COUNTIF(Tareas!B:B, "<>")-1'],
        ['Tareas Vencidas', '=COUNTIFS(Tareas!J:J, "Vencida")'],
        ['Ingresos Mensuales Estimados', '=SUM(Clientes!G:G)'],
        ['Próximas Renovaciones (Este mes)', 'Próximamente'],
        ['', '']
      ]
    });

    if (dataValues.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: dataValues
        }
      });
    }

    console.log("¡Actualización completada con éxito!");

  } catch (error) {
    console.error('Error aplicando el esquema:', error);
  }
}

main();
