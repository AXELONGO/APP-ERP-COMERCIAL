const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

const names = ['Axel', 'Laura', 'Carlos', 'Ana', 'Luis', 'Sofia', 'Jorge', 'Marta'];
const companies = ['TechCorp', 'Innova', 'Design Studio', 'Alpha Co', 'Beta LLC', 'Omega Inc'];
const services = ['Servicios de diagnóstico', 'Diseño de sistemas', 'Automatización', 'Diseño web', 'Campaña ADS', 'Paquete contenido', 'Branding', 'Socio de crecimiento', 'Video', 'Diseño gráfico'];
const roles = ['Diseño', 'Campañas', 'Web', 'Administración'];
const taskStatus = ['Pendiente', 'En Proceso', 'Terminado'];
const projStatus = ['Activo', 'Detenido', 'Cerrado'];
const pipelineStages = ['1', '2', '3', '4', '5', '6', '7'];
const indicadores = ['Llamadas', 'Agencia Creativo', 'Agencia Video', 'Personal Video', 'Kaizen', 'Lunes Operación', 'Viernes Estrategia'];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randArr(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateData() {
  const data = {};

  // 1. Clientes
  data['Clientes'] = [];
  for (let i = 1; i <= 50; i++) {
    data['Clientes'].push([
      '', // A: ID autogenerado
      randArr(names) + ' Perez', // Nombre
      `cliente${i}@test.com`, // Correo
      '555-000-' + randInt(1000, 9999), // Tel
      '2024-01-' + String(randInt(1, 28)).padStart(2, '0'), // Fecha Reg
      randArr(companies) + ' ' + i, // Empresa
      'Calle ' + i, // Dir
      'Nota ' + i, // Notas
      '', '', '', // Proyectos, Contratos, Parrilla
      'Activo', // Estado
      randArr(names), // Ejecutivo
      randArr(services), // Servicios
      '2024-12-01', // Renovacion
      randInt(500, 5000), // Valor mes
      randInt(6000, 60000), // Valor anual
      'Alta', // Prioridad
      'Al día' // Estatus
    ]);
  }

  // 2. Proyectos
  data['Proyectos'] = [];
  for (let i = 1; i <= 50; i++) {
    data['Proyectos'].push([
      '', // ID autogen
      'Proyecto ' + randArr(companies) + ' ' + i, // Nombre
      'CLI-' + String(randInt(1, 50)).padStart(3, '0'), // ID Cliente

      '2024-01-01', // Inicio
      '2024-06-01', // Fin
      randArr(projStatus), // Estado
      'Ok', // Notas
      '', '', // Contratos, Duracion
      randArr(services), // Servicio
      randArr(pipelineStages), // Etapa actual
      randInt(10, 100) / 100, // % Avance
      'Revisar ads', // Proxima tarea
      '2024-02-15', // Proxima reunion
      randInt(0, 10), // Dias sin mov
      'Media', // Prioridad
      'Bajo' // Riesgo
    ]);
  }

  // 3. Tareas
  data['Tareas'] = [];
  for (let i = 1; i <= 50; i++) {
    data['Tareas'].push([
      '', // ID
      'PRJ-' + String(randInt(1, 50)).padStart(3, '0'), // ID Proy
      'CLI-' + String(randInt(1, 50)).padStart(3, '0'), // ID Cliente
      randArr(roles), // Categoria
      'Hacer tarea ' + i, // Tarea
      randArr(names), // Responsable
      'Alta', // Prioridad
      '2024-02-01', // Inicio
      '2024-02-10', // Limite
      randArr(taskStatus), // Estado
      'link.com', // Evidencia
      'Nota ' + i // Comentarios
    ]);
  }

  // 4. Registro de Actividades
  data['Registro de Actividades'] = [];
  // Populate the last 5 days
  for (let i = 1; i <= 50; i++) {
    let indic = randArr(indicadores);
    let cant = indic === 'Llamadas' ? randInt(50, 300) : randInt(1, 2);
    data['Registro de Actividades'].push([
      '', // ID
      '2026-07-' + String(randInt(1, 7)).padStart(2, '0'), // Fecha (Current week roughly)
      '', // Semana automatica
      indic, // Tipo
      cant, // Cantidad
      'PRJ-' + String(randInt(1, 50)).padStart(3, '0'), // ID Rel
      randArr(names), // Responsable
      'Hecho'
    ]);
  }

  return data;
}

async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const seedData = generateData();
    const dataValues = [];

    for (const [sheetName, rows] of Object.entries(seedData)) {
      // Find the row to append to. Easiest is just appending values.
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A:A`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rows }
      });
      console.log(`✅ 50 registros insertados en ${sheetName}`);
    }

    console.log('¡Datos cargados con éxito! Ve a revisar tu Dashboard y Tracker Semanal para auditar.');

  } catch (error) {
    console.error('Error inyectando datos:', error.message);
  }
}

main();
