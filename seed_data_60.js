const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

const names = ['Axel', 'Laura', 'Carlos', 'Ana', 'Luis', 'Sofia', 'Jorge', 'Marta', 'Brena', 'David'];
const companies = ['TechCorp', 'Innova', 'Design Studio', 'Alpha Co', 'Beta LLC', 'Omega Inc', 'Delta Force', 'Zeta Global'];
const services = ['Servicios de diagnóstico', 'Diseño de sistemas', 'Automatización', 'Diseño web', 'Campaña ADS', 'Paquete contenido', 'Branding'];
const roles = ['Diseño', 'Campañas', 'Web', 'Administración'];
const taskStatus = ['Pendiente', 'En Proceso', 'Terminado'];
const projStatus = ['Activo', 'Detenido', 'Cerrado'];
const indicadores = ['Llamadas / prospección', 'Creativos', 'Videos', 'Creación de contenido empresa', 'Marcas personales', 'Avances y mejoras de negocio'];
const priorities = ['Alta', 'Media', 'Baja'];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randArr = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randDate = () => `2026-07-${String(randInt(1, 28)).padStart(2, '0')}`;

const NUM_RECORDS = 60;

function generateData() {
  const data = {};

  // 1. Clientes
  data['Clientes'] = [];
  for (let i = 1; i <= NUM_RECORDS; i++) {
    data['Clientes'].push([
      `CLI-${String(i+100).padStart(3, '0')}`, // ID
      randArr(names) + ' Cliente', // Nombre
      `cliente${i}@test.com`, // Correo
      '555-200-' + randInt(1000, 9999), // Tel
      randDate(), // Fecha Reg
      randArr(companies) + ' ' + i, // Empresa
      'Calle Falsa 123', // Dir
      'Cliente semilla', // Notas
      'Activo', // Estado
      randArr(services), // Servicios
      randDate(), // Renovacion
      randInt(500, 5000), // Valor mes
      randArr(priorities), // Prioridad
      'Al día' // Estatus
    ]);
  }

  // 2. Prospectos
  data['Prospectos'] = [];
  for (let i = 1; i <= NUM_RECORDS; i++) {
    data['Prospectos'].push([
      `PRO-${String(i+100).padStart(3, '0')}`,
      randArr(names) + ' Prospecto',
      `prospecto${i}@test.com`,
      '555-300-' + randInt(1000, 9999),
      'Interesado en servicios',
      randDate(),
      randArr(names)
    ]);
  }

  // 3. Proyectos
  data['Proyectos'] = [];
  for (let i = 1; i <= NUM_RECORDS; i++) {
    data['Proyectos'].push([
      `PRJ-${String(i+100).padStart(3, '0')}`,
      'Proyecto ' + randArr(companies),
      `CLI-${String(randInt(101, 100+NUM_RECORDS)).padStart(3, '0')}`,
      randArr(projStatus),
      'Notas del proyecto',
      randArr(services),
      String(randInt(1, 7)),
      '', // % Avance (formula, leave blank if we append as values, but Google might just leave it blank)
      randDate(), // Próxima reunión
      randInt(0, 10), // Días sin mov
      randArr(priorities),
      randArr(['Bajo', 'Medio', 'Alto']),
      randDate()
    ]);
  }

  // 4. Pipeline de Proyecto
  data['Pipeline de Proyecto'] = [];
  for (let i = 1; i <= NUM_RECORDS; i++) {
    data['Pipeline de Proyecto'].push([
      `PIP-${String(i+100).padStart(3, '0')}`,
      `PRJ-${String(randInt(101, 100+NUM_RECORDS)).padStart(3, '0')}`,
      `CLI-${String(randInt(101, 100+NUM_RECORDS)).padStart(3, '0')}`,
      String(randInt(1, 7)),
      randArr(names),
      randDate(),
      randDate(),
      '', // Días (formula)
      randArr(taskStatus),
      'Comentario pipeline',
      randDate()
    ]);
  }

  // 5. Tareas
  data['Tareas'] = [];
  for (let i = 1; i <= NUM_RECORDS; i++) {
    data['Tareas'].push([
      `TAR-${String(i+100).padStart(3, '0')}`,
      `PRJ-${String(randInt(101, 100+NUM_RECORDS)).padStart(3, '0')}`,
      `CLI-${String(randInt(101, 100+NUM_RECORDS)).padStart(3, '0')}`,
      randArr(roles),
      'Hacer tarea ' + i,
      randArr(names),
      randArr(priorities),
      randDate(),
      randDate(),
      randArr(taskStatus),
      'link.com',
      'Tarea autogenerada',
      randDate()
    ]);
  }

  // 6. Citas
  data['Citas'] = [];
  for (let i = 1; i <= NUM_RECORDS; i++) {
    data['Citas'].push([
      `CIT-${String(i+100).padStart(3, '0')}`,
      randDate(),
      `${String(randInt(9, 18)).padStart(2, '0')}:00`,
      `CLI-${String(randInt(101, 100+NUM_RECORDS)).padStart(3, '0')}`,
      randArr(['Presencial', 'Virtual', 'Llamada']),
      'Cita de seguimiento',
      randArr(names),
      randArr(['Pendiente', 'Exitosa', 'Reprogramada']),
      'Mandar propuesta'
    ]);
  }

  // 7. Asesores
  data['Asesores'] = [];
  for (let i = 1; i <= NUM_RECORDS; i++) {
    data['Asesores'].push([
      `ASE-${String(i+100).padStart(3, '0')}`,
      randArr(names) + ' ' + randArr(['Gomez', 'Lopez', 'Perez', 'Martinez', 'Garcia', 'Ortiz']),
      `asesor${i}@empresa.com`,
      '555-100-' + randInt(1000, 9999),
      randDate(),
      'Asesor de prueba'
    ]);
  }

  // 8. Actividades
  data['Actividades'] = [];
  for (let i = 1; i <= NUM_RECORDS; i++) {
    data['Actividades'].push([
      `ACT-${String(i+100).padStart(3, '0')}`,
      randDate(),
      randArr(indicadores),
      randInt(1, 10),
      'Actividad registrada auto',
      randArr(names)
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

    for (const [sheetName, rows] of Object.entries(seedData)) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A:A`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rows }
      });
      console.log(`✅ 60 registros insertados en ${sheetName}`);
    }

    console.log('¡Datos cargados con éxito!');

  } catch (error) {
    console.error('Error inyectando datos:', error.message);
  }
}

main();
