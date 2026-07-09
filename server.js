const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const asyncHandler = require('./utils/asyncHandler');
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { reportBug } = require('./utils/bugReporter');

// Uncaught Exception / Unhandled Rejection Handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  reportBug({ level: 'critical', message: 'Uncaught Exception: ' + err.message, error: err })
    .finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  reportBug({ level: 'critical', message: 'Unhandled Rejection: ' + (reason?.message || reason), error: reason });
});


// ─── WORKAROUND: SINCRONIZACIÓN DE RELOJ PARA JWT ─────────────
// Esto previene de forma programática el error "Invalid JWT Signature" 
// forzando a Node a generar tokens con la hora real de internet en lugar de la hora desfasada de Docker/Mac.
const originalDateNow = Date.now;
let timeOffset = 0;
(async function syncClock() {
  try {
    const res = await fetch('http://worldtimeapi.org/api/timezone/Etc/UTC');
    const data = await res.json();
    const realTime = new Date(data.utc_datetime).getTime();
    timeOffset = realTime - originalDateNow();
    Date.now = () => originalDateNow() + timeOffset;
    console.log(`\n[Seguridad] Reloj interno sincronizado correctamente. Offset: ${timeOffset}ms\n`);
  } catch (err) {
    console.error("[Seguridad] Fallo al sincronizar reloj:", err.message);
  }
})();
// ──────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

// ─── SEGURIDAD ────────────────────────────────────────────────
// Habilitar Helmet para proteger cabeceras HTTP (con configuración flexible para no romper assets ni iframes)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Límite de peticiones para evitar ataques DDoS y fuerza bruta (100 peticiones cada 15 min por IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Aumentado a 200 para permitir el uso normal del ERP
  message: { error: 'Demasiadas peticiones desde esta IP. Por favor intenta de nuevo en 15 minutos.' }
});
app.use(limiter);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── AUTH ─────────────────────────────────────────────────────
async function getSheets() {
  let authOptions = {
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  };
  
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      authOptions.credentials = typeof process.env.GOOGLE_CREDENTIALS === 'string' 
        ? JSON.parse(process.env.GOOGLE_CREDENTIALS) 
        : process.env.GOOGLE_CREDENTIALS;
    } catch (e) {
      console.error('[AUTH] Error parsing GOOGLE_CREDENTIALS env var:', e.message);
    }
  } else {
    authOptions.keyFile = path.join(__dirname, 'credentials.json');
  }

  const auth = new google.auth.GoogleAuth(authOptions);
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

// Helper para parsear la DB pública (Bypass total de auth y JWT signature errors para lecturas)
async function getPublicData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();
  const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)[1];
  const data = JSON.parse(jsonString);
  
  const headers = data.table.cols.map(c => c.label || '');
  return data.table.rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = r.c[i] ? (r.c[i].f !== undefined ? r.c[i].f : r.c[i].v) : '';
      if (val === null) val = '';
      obj[h] = String(val);
    });
    return obj;
  });
}

function toRows(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, i) => {
    const obj = { _rowIndex: i + 2 }; // 1-indexed, +1 for header, +1 for 1-based
    headers.forEach((h, j) => { obj[h] = row[j] || ''; });
    return obj;
  });
}

// Find actual row number in sheet by column A value (ID)
async function findRowById(sheets, sheetName, id) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A:A`,
  });
  const vals = r.data.values || [];
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0] === id) return i + 1; // 1-indexed
  }
  return -1;
}

// Get sheetId by title
async function getSheetId(sheets, title) {
  const r = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = r.data.sheets.find(s => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}

// ─── GENERIC CRUD FACTORY ─────────────────────────────────────
const PREFIX_MAP = {
  'Clientes': 'CLI-',
  'Prospectos': 'PRO-',
  'Proyectos': 'PRJ-',
  'Pipeline de Proyecto': 'PIP-',
  'Tareas': 'TAR-',
  'Citas': 'CIT-',
  'Asesores': 'ASE-',
  'Actividades': 'ACT-'
};

function crudRoutes(sheetName, range, mapper, customEndpoint) {
  const endpoint = customEndpoint || sheetName.toLowerCase().replace(/ /g, '_');

  // GET (Bypass de Auth para lecturas ultrarrápidas y sin errores de JWT)
  app.get(`/api/${endpoint}`, asyncHandler(async (req, res) => {
      const rows = await getPublicData(sheetName);
      res.json(rows);
}));

  // POST
  app.post(`/api/${endpoint}`, asyncHandler(async (req, res) => {
      const sheets = await getSheets();
      
      // Generate ID explicitly in Node
      let nextId = '';
      const prefix = PREFIX_MAP[sheetName];
      if (prefix) {
        const getRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${sheetName}'!A2:A`,
        });
        const existingData = getRes.data.values || [];
        const maxNum = existingData.reduce((max, row) => {
          const m = row[0] ? row[0].match(/\d+/) : null;
          return m ? Math.max(max, parseInt(m[0], 10)) : max;
        }, 0);
        nextId = `${prefix}${(maxNum + 1).toString().padStart(3, '0')}`;
      }

      const getRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${sheetName}'!A:A` });
      const numRows = (getRes.data.values || []).length;
      const nextRowNum = numRows + 1;

      const row = mapper(req.body, [nextId], [], nextRowNum);
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A:A`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] },
      });
      res.json({ success: true, id: nextId });
}));

  // UPDATE
  app.put(`/api/${endpoint}/:id`, asyncHandler(async (req, res) => {
      const sheets = await getSheets();
      const rowNum = await findRowById(sheets, sheetName, req.params.id);
      if (rowNum === -1) return res.status(404).json({ error: 'Registro no encontrado' });
      
      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A${rowNum}:Z${rowNum}`,
      });
      const getFormulaRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A${rowNum}:Z${rowNum}`,
        valueRenderOption: 'FORMULA'
      });
      const existingRow = getRes.data.values ? getRes.data.values[0] : [];
      const existingFormulas = getFormulaRes.data.values ? getFormulaRes.data.values[0] : [];
      
      const row = mapper(req.body, existingRow, existingFormulas, rowNum);
      row[0] = req.params.id; // keep the ID
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] },
      });
      res.json({ success: true });
}));

  // DELETE
  app.delete(`/api/${endpoint}/:id`, asyncHandler(async (req, res) => {
      const sheets = await getSheets();
      const rowNum = await findRowById(sheets, sheetName, req.params.id);
      if (rowNum === -1) return res.status(404).json({ error: 'Registro no encontrado' });
      const sheetId = await getSheetId(sheets, sheetName);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowNum - 1,
                endIndex: rowNum,
              }
            }
          }]
        }
      });
      res.json({ success: true });
}));
}

// ─── MODULES ──────────────────────────────────────────────────

crudRoutes('Clientes', 'A:O', (d, e = []) => [
  e[0] || '', // ID Clientes (A)
  d.nombre !== undefined ? d.nombre : (e[1] || ''), // Nombre del Cliente (B)
  d.correo !== undefined ? d.correo : (e[2] || ''), // Correo Electrónico (C)
  d.telefono !== undefined ? d.telefono : (e[3] || ''), // Teléfono Principal (D)
  d.fechaRegistro !== undefined ? d.fechaRegistro : (e[4] || new Date().toISOString().split('T')[0]), // Fecha de Registro (E)
  d.empresa !== undefined ? d.empresa : (e[5] || ''), // Empresa o Razón Social (F)
  d.direccion !== undefined ? d.direccion : (e[6] || ''), // Dirección (G)
  d.notas !== undefined ? d.notas : (e[7] || ''), // Notas (H)
  d.estado !== undefined ? d.estado : (e[8] || 'Activo'), // Estado (I)
  d.servicios !== undefined ? d.servicios : (e[9] || ''), // Servicios (J)
  d.renovacion !== undefined ? d.renovacion : (e[10] || ''), // Renovación (K)
  d.valorMensual !== undefined ? d.valorMensual : (e[11] || ''), // Valor mensual (L)
  d.prioridad !== undefined ? d.prioridad : (e[12] || 'Media'), // Prioridad (M)
  d.estatus !== undefined ? d.estatus : (e[13] || 'Al día'), // Estatus (N)
  d.giro !== undefined ? d.giro : (e[14] || '') // Giro (O)
]);

crudRoutes('Prospectos', 'A:L', (d, e = []) => [
  e[0] || '', 
  d.nombre !== undefined ? d.nombre : (e[1] || ''), 
  d.correo !== undefined ? d.correo : (e[2] || ''), 
  d.telefono !== undefined ? d.telefono : (e[3] || ''), 
  d.notas !== undefined ? d.notas : (e[4] || ''),
  d.fechaRegistro !== undefined ? d.fechaRegistro : (e[5] || new Date().toISOString().split('T')[0]),
  d.asesor !== undefined ? d.asesor : (e[6] || ''),
  d.medioDeContacto !== undefined ? d.medioDeContacto : (e[7] || ''),
  d.situacion !== undefined ? d.situacion : (e[8] || ''),
  d.problema !== undefined ? d.problema : (e[9] || ''),
  d.implicacion !== undefined ? d.implicacion : (e[10] || ''),
  d.necesidad !== undefined ? d.necesidad : (e[11] || '')
]);

crudRoutes('Proyectos', 'A:M', (d, e = [], f = [], rowNum) => [
  e[0] || '', // ID Proyectos (A)
  d.nombre !== undefined ? d.nombre : (e[1] || ''), // Nombre del Proyecto (B)
  d.idCliente !== undefined ? d.idCliente : (e[2] || ''), // Cliente Relacionado (C)
  d.estado !== undefined ? d.estado : (e[3] || 'Activo'), // Estado del Proyecto (D)
  d.notas !== undefined ? d.notas : (e[4] || ''), // Notas (E)
  d.servicio !== undefined ? d.servicio : (e[5] || ''), // Servicio (F)
  d.etapa !== undefined ? d.etapa : (e[6] || '1'), // Etapa actual (G)
  `=SI(G${rowNum || 2}="","",G${rowNum || 2}*14.285714286%)`, // % Avance (H) - FORCED FORMULA
  e[8] || '', // Próxima reunión (I)
  e[9] || '', // Días sin movimiento (J)
  d.prioridad !== undefined ? d.prioridad : (e[10] || 'Media'), // Prioridad (K)
  d.riesgo !== undefined ? d.riesgo : (e[11] || 'Bajo'), // Riesgo (L)
  d.fechaRegistro !== undefined ? d.fechaRegistro : (e[12] || new Date().toISOString().split('T')[0]) // Fecha de Registro (M)
]);

crudRoutes('Pipeline de Proyecto', 'A:K', (d, e = []) => [
  e[0] || '', 
  d.idProyecto !== undefined ? d.idProyecto : (e[1] || ''), 
  d.idCliente !== undefined ? d.idCliente : (e[2] || ''), 
  d.etapa !== undefined ? d.etapa : (e[3] || ''), 
  d.responsable !== undefined ? d.responsable : (e[4] || ''),
  d.fechaInicio !== undefined ? d.fechaInicio : (e[5] || ''), 
  d.fechaFin !== undefined ? d.fechaFin : (e[6] || ''), 
  e[7] || '', 
  d.estado !== undefined ? d.estado : (e[8] || 'En Proceso'), 
  d.comentarios !== undefined ? d.comentarios : (e[9] || ''),
  d.fechaRegistro !== undefined ? d.fechaRegistro : (e[10] || new Date().toISOString().split('T')[0])
]);

crudRoutes('Tareas', 'A:M', (d, e = []) => [
  e[0] || '', 
  d.idProyecto !== undefined ? d.idProyecto : (e[1] || ''), 
  d.idCliente !== undefined ? d.idCliente : (e[2] || ''), 
  d.categoria !== undefined ? d.categoria : (e[3] || ''), 
  d.tarea !== undefined ? d.tarea : (e[4] || ''),
  d.responsable !== undefined ? d.responsable : (e[5] || ''), 
  d.prioridad !== undefined ? d.prioridad : (e[6] || 'Media'), 
  d.fechaInicio !== undefined ? d.fechaInicio : (e[7] || ''),
  d.fechaLimite !== undefined ? d.fechaLimite : (e[8] || ''), 
  d.estado !== undefined ? d.estado : (e[9] || 'Pendiente'), 
  d.evidencia !== undefined ? d.evidencia : (e[10] || ''), 
  d.comentarios !== undefined ? d.comentarios : (e[11] || ''),
  d.fechaRegistro !== undefined ? d.fechaRegistro : (e[12] || new Date().toISOString().split('T')[0])
]);

crudRoutes('Citas', 'A:N', (d, e = []) => [
  e[0] || '', // ID Citas (0)
  d.nombre !== undefined ? d.nombre : (e[1] || ''), // Nombre (1)
  d.fechaRegistro !== undefined ? d.fechaRegistro : (e[2] || new Date().toISOString().split('T')[0]), // Fecha de Registro (2)
  d.correo !== undefined ? d.correo : (e[3] || ''), // Correo (3)
  d.telefono !== undefined ? d.telefono : (e[4] || ''), // Teléfono (4)
  d.fecha !== undefined ? d.fecha : (e[5] || ''), // Fecha de la Cita (5)
  d.hora !== undefined ? d.hora : (e[6] || ''), // Hora de la Cita (6)
  d.notas !== undefined ? d.notas : (e[7] || ''), // Notas (7)
  d.idProyecto !== undefined ? d.idProyecto : (e[8] || ''), // ID Proyecto (8)
  d.idCliente !== undefined ? d.idCliente : (e[9] || ''), // ID Cliente (9)
  d.tipo !== undefined ? d.tipo : (e[10] || ''), // Tipo de reunión (10)
  d.responsable !== undefined ? d.responsable : (e[11] || ''), // Responsable (11)
  d.resultado !== undefined ? d.resultado : (e[12] || ''), // Resultado (12)
  d.proximaAccion !== undefined ? d.proximaAccion : (e[13] || '') // Próxima acción (13)
]);

crudRoutes('Actividades', 'A:F', (d, e = []) => [
  e[0] || '', // ID Actividad
  d.fecha !== undefined ? d.fecha : (e[1] || new Date().toISOString().split('T')[0]), // Fecha
  d.indicador !== undefined ? d.indicador : (e[2] || ''), // Indicador
  d.cantidad !== undefined ? d.cantidad : (e[3] || '1'), // Cantidad
  d.notas !== undefined ? d.notas : (e[4] || ''), // Notas
  d.responsable !== undefined ? d.responsable : (e[5] || '') // Responsable
], 'actividades');

crudRoutes('Asesores', 'A:F', (d, e = []) => [
  e[0] || '',
  d.nombre !== undefined ? d.nombre : (e[1] || ''),
  d.correo !== undefined ? d.correo : (e[2] || ''),
  d.telefono !== undefined ? d.telefono : (e[3] || ''),
  d.fechaRegistro !== undefined ? d.fechaRegistro : (e[4] || new Date().toISOString().split('T')[0]),
  d.notas !== undefined ? d.notas : (e[5] || '')
]);

// ─── END MODULES ────────────────────────────────────────────────



// ─── DASHBOARD ────────────────────────────────────────────────
app.get('/api/dashboard', asyncHandler(async (req, res) => {
    const [clientes, proyectos, tareas, pipeline, prospectos, citas] = await Promise.all([
      getPublicData('Clientes'),
      getPublicData('Proyectos'),
      getPublicData('Tareas'),
      getPublicData('Pipeline de Proyecto'),
      getPublicData('Prospectos'),
      getPublicData('Citas')
    ]);

    const clientesActivos = clientes.filter(c => c['Estado'] === 'Activo').length;
    const proyectosActivos = proyectos.filter(p => p['Estado del Proyecto'] === 'Activo').length;
    const proyectosReunion = proyectos.filter(p => p['Estado del Proyecto'] === 'Reunión').length;
    const tareasPendientes = tareas.filter(t => t['Estado'] === 'Pendiente').length;
    const tareasEnProceso = tareas.filter(t => t['Estado'] === 'En Proceso').length;
    const ingresosMensuales = clientes.reduce((s, c) => s + (parseFloat(c['Valor mensual']) || 0), 0);

    // % avance por proyecto desde Pipeline
    const avancePorProyecto = {};
    pipeline.forEach(p => {
      const pid = p['ID Proyecto'];
      if (!pid) return;
      if (!avancePorProyecto[pid]) avancePorProyecto[pid] = 0;
      if (p['Estado'] === 'Completado') avancePorProyecto[pid]++;
    });
    const avances = Object.values(avancePorProyecto).map(n => (n / 6) * 100);
    const avancePromedio = avances.length ? Math.round(avances.reduce((a, b) => a + b, 0) / avances.length) : 0;

    // ingresos por mes
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const ingresosPorMes = {};
    clientes.forEach(c => {
      const d = new Date(c['Fecha de Registro']);
      if (isNaN(d)) return;
      const m = meses[d.getMonth()];
      ingresosPorMes[m] = (ingresosPorMes[m] || 0) + (parseFloat(c['Valor mensual']) || 0);
    });

    // servicios
    const serviciosCount = {};
    clientes.forEach(c => {
      const s = c['Servicios contratados'];
      if (s && s.length > 2 && isNaN(s) && !s.includes('@'))
        serviciosCount[s] = (serviciosCount[s] || 0) + 1;
    });

    // etapas del pipeline
    const etapasCount = {};
    proyectos.forEach(p => {
      const e = p['Etapa actual'];
      if (e) etapasCount[e] = (etapasCount[e] || 0) + 1;
    });

    // próximas citas (próximos 7 días)
    const hoy = new Date();
    const enSiete = new Date(); enSiete.setDate(hoy.getDate() + 7);
    const proximasCitas = citas.filter(c => {
      const d = new Date(c['Fecha de la Cita']);
      return d >= hoy && d <= enSiete;
    }).length;

    res.json({
      clientesActivos, prospectosTotales: prospectos.length,
      proyectosActivos, proyectosReunion,
      tareasPendientes, tareasEnProceso,
      ingresosMensuales, avancePromedio,
      ingresosPorMes, serviciosCount, etapasCount, proximasCitas,
      totalClientes: clientes.length, totalProyectos: proyectos.length,
    });
}));

// ─── TRACKER ──────────────────────────────────────────────────
app.get('/api/tracker', asyncHandler(async (req, res) => {
    const data = await getPublicData('Tracker Semanal');
    res.json(data);
}));

// ─── WEBHOOK CORS PROXY ─────────────────────────────────────────
app.post('/api/webhook-proxy', asyncHandler(async (req, res) => {
    const { url, payload } = req.body;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    res.json({ success: response.ok, status: response.status, data });
}));


app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, () => console.log(`\n🚀 ERP LUMARK → http://localhost:${PORT}\n`));

