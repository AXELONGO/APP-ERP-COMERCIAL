// ── API BASE ──────────────────────────────────────────────────
var API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000' : '';

// ── XSS SAFE ─────────────────────────────────────────────────
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  if (typeof unsafe !== 'string') return String(unsafe);
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── TRUNCATE ─────────────────────────────────────────────────
function truncate(str, n) {
  return str && str.length > n ? str.substring(0, n) + '...' : (str || '');
}

// ── DATE HELPERS ─────────────────────────────────────────────
function formatDateToISO(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  return dateStr;
}

function setTodayDate(inputId) {
  var el = document.getElementById(inputId);
  if (el) el.value = new Date().toISOString().split('T')[0];
}

// ── DEBOUNCE ─────────────────────────────────────────────────
function debounce(fn, delay) {
  delay = delay || 300;
  var timer;
  return function () {
    var args = arguments;
    var self = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(self, args); }, delay);
  };
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg, isError) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerHTML = msg;
  toast.style.borderColor = isError ? 'var(--red)' : 'var(--green)';
  toast.style.color = isError ? 'var(--red)' : 'var(--green)';
  toast.classList.remove('hidden');
  setTimeout(function () { toast.classList.add('hidden'); }, 3500);
}

// ── BADGES ───────────────────────────────────────────────────
function statusBadge(s) {
  if (!s) return '<span class="badge badge-gray">—</span>';
  var map = { 'Activo': 'green', 'Inactivo': 'red', 'Reunión': 'orange', 'Cerrado': 'gray', 'Detenido': 'orange' };
  return '<span class="badge badge-' + (map[s] || 'gray') + '">' + escapeHtml(s) + '</span>';
}

function priorityBadge(p) {
  if (!p) return '<span class="badge badge-gray">—</span>';
  var map = { 'Alta': 'red', 'Media': 'orange', 'Baja': 'green' };
  return '<span class="badge badge-' + (map[p] || 'gray') + '">' + escapeHtml(p) + '</span>';
}

function riskBadge(r) {
  if (!r) return '<span class="badge badge-gray">—</span>';
  var map = { 'Alto': 'red', 'Medio': 'orange', 'Bajo': 'green' };
  return '<span class="badge badge-' + (map[r] || 'gray') + '">' + escapeHtml(r) + '</span>';
}

function taskStatusBadge(s) {
  if (!s) return '<span class="badge badge-gray">—</span>';
  var map = { 'Terminado': 'green', 'En Proceso': 'blue', 'Pendiente': 'orange', 'Vencida': 'red' };
  return '<span class="badge badge-' + (map[s] || 'gray') + '">' + escapeHtml(s) + '</span>';
}

function pipelineStatusBadge(s) {
  if (!s) return '<span class="badge badge-gray">—</span>';
  var map = { 'Completado': 'green', 'En Proceso': 'blue', 'Bloqueado': 'red' };
  return '<span class="badge badge-' + (map[s] || 'gray') + '">' + escapeHtml(s) + '</span>';
}

// ── EMPTY STATE ──────────────────────────────────────────────
function emptyState() {
  return '<tr><td colspan="20"><div class="empty-state"><p>No hay registros aún. Usa "+ Nuevo Registro" para comenzar.</p></div></td></tr>';
}

// ── GENERATE OPTIONS ─────────────────────────────────────────
function generateOptions(dataStore, idKey, nameKey) {
  if (!window[dataStore] || !window[dataStore].length) return '<option value="">Cargando / Sin datos...</option>';
  return window[dataStore].map(function (r) {
    return '<option value="' + escapeHtml(r[idKey]) + '">' + escapeHtml(r[nameKey]) + '</option>';
  }).join('');
}

// ── CHARTS ───────────────────────────────────────────────────
var chartInstances = {};

function renderBarChart(canvasId, dataObj, labelStr, colorHex) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
  var labels = Object.keys(dataObj);
  var values = Object.values(dataObj);
  if (!labels.length) { ctx.parentElement.innerHTML = '<div class="empty-state">Sin datos</div>'; return; }
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: [{ label: labelStr, data: values, backgroundColor: colorHex || '#6366f1', borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
    }
  });
}

function renderDoughnutChart(canvasId, dataObj) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
  var labels = Object.keys(dataObj);
  var data = Object.values(dataObj);
  if (!labels.length) { ctx.parentElement.innerHTML = '<div class="empty-state">Sin datos</div>'; return; }
  var colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } } } }
  });
}

// ── ETAPAS MAP ───────────────────────────────────────────────
var ETAPAS_MAP = {
  '0': '<span class="badge badge-gray">Sin Iniciar</span>',
  '1': '<span class="badge badge-blue">Activación</span>',
  '2': '<span class="badge badge-purple">Diagnóstico</span>',
  '3': '<span class="badge badge-orange">Calendario Contenido</span>',
  '4': '<span class="badge badge-green">Creación Contenido</span>',
  '5': '<span class="badge badge-red">Campaña</span>',
  '6': '<span class="badge badge-blue">Reporte Resultados</span>',
  '7': '<span class="badge badge-orange">Renovación</span>'
};

var ETAPAS_LABELS = {
  '1': '1 → Activación', '2': '2 → Diagnóstico', '3': '3 → Calendario',
  '4': '4 → Creación Cont.', '5': '5 → Campaña', '6': '6 → Reporte', '7': '7 → Renovación'
};

function formatEtapa(e) {
  var num = String(e || '1');
  return ETAPAS_MAP[num] || '<span class="badge badge-gray">' + escapeHtml(e) + '</span>';
}

function getEtapaLabel(e) {
  return ETAPAS_LABELS[String(e)] || e;
}

// ── MAPPING (form keys → sheet columns) ──────────────────────
var MAPPING = {
  nombre: ['Nombre del Cliente', 'Nombre del Contacto', 'Nombre del Proyecto', 'Nombre'],
  empresa: ['Empresa o Razón Social', 'Nombre del Negocio'],
  correo: ['Correo Electrónico', 'Correo'],
  telefono: ['Teléfono Principal', 'Teléfono'],
  estado: ['Estado', 'Estado del Proyecto'],
  notas: ['Notas'],
  servicio: ['Servicio', 'Servicios contratados'],
  servicios: ['Servicios contratados', 'Servicios'],
  asesor: ['Asesor'],
  responsable: ['Responsable'],
  prioridad: ['Prioridad'],
  riesgo: ['Riesgo'],
  fechaRegistro: ['Fecha de Registro'],
  renovacion: ['Renovación'],
  direccion: ['Dirección'],
  giro: ['Giro'],
  estatus: ['Estatus'],
  valorMensual: ['Valor mensual'],
  tarea: ['Tarea'],
  categoria: ['Categoría'],
  idProyecto: ['ID Proyecto'],
  idCliente: ['ID Cliente'],
  fecha: ['Fecha de la Cita', 'Fecha'],
  hora: ['Hora de la Cita', 'Hora'],
  tipo: ['Tipo de reunión', 'Tipo'],
  resultado: ['Resultado'],
  proximaaccion: ['Próxima acción'],
  nombrenegocio: ['Nombre del Negocio'],
  situacion: ['Situación'],
  problema: ['Problema'],
  implicacion: ['Implicación'],
  necesidad: ['Necesidad'],
  cantidad: ['Cantidad'],
  indicador: ['Indicador'],
  medioDeContacto: ['Medio de contacto'],
  fechaInicio: ['Fecha Inicio'],
  fechaLimite: ['Fecha límite'],
  comentarios: ['Comentarios'],
  evidencia: ['Evidencia'],
  notasCliente: ['Notas sobre el Cliente']
};

// ── PAGINATION ───────────────────────────────────────────────
var paginationState = {};

function createPagination(total, page, pageSize, callback) {
  var totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return '';
  var html = '<div class="pagination">';
  html += '<button class="btn btn-sm btn-outline" onclick="window.paginationCallback(' + (page - 1) + ',' + pageSize + ')"' + (page <= 1 ? ' disabled' : '') + '>‹ Anterior</button>';
  html += '<span class="pagination-info">Página ' + page + ' de ' + totalPages + ' (' + total + ' registros)</span>';
  html += '<button class="btn btn-sm btn-outline" onclick="window.paginationCallback(' + (page + 1) + ',' + pageSize + ')"' + (page >= totalPages ? ' disabled' : '') + '>Siguiente ›</button>';
  html += '</div>';
  window.paginationCallback = callback;
  return html;
}

// ── EXPORTS (global) ─────────────────────────────────────────
window.API = API;
window.escapeHtml = escapeHtml;
window.truncate = truncate;
window.debounce = debounce;
window.showToast = showToast;
window.statusBadge = statusBadge;
window.priorityBadge = priorityBadge;
window.riskBadge = riskBadge;
window.taskStatusBadge = taskStatusBadge;
window.pipelineStatusBadge = pipelineStatusBadge;
window.emptyState = emptyState;
window.generateOptions = generateOptions;
window.renderBarChart = renderBarChart;
window.renderDoughnutChart = renderDoughnutChart;
window.formatEtapa = formatEtapa;
window.getEtapaLabel = getEtapaLabel;
window.ETAPAS_MAP = ETAPAS_MAP;
window.ETAPAS_LABELS = ETAPAS_LABELS;
window.MAPPING = MAPPING;
window.formatDateToISO = formatDateToISO;
window.setTodayDate = setTodayDate;
window.createPagination = createPagination;
window.paginationState = paginationState;
window.chartInstances = chartInstances;
