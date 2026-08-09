// ── GLOBALS ───────────────────────────────────────────────────────
// The UI is served by the same Express process in local and hosted environments.
// Using a relative API avoids sending local requests to the wrong port/container.
const API = '';
let currentSection = 'dashboard';

function renderBarChart(canvasId, dataObj, labelStr, colorHex) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const labels = Object.keys(dataObj);
    const data = Object.values(dataObj);

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: labelStr,
          data: data,
          backgroundColor: colorHex + '40', // 25% opacity
          borderColor: colorHex,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8b92b8', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#8b92b8', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
        }
      }
    });
}

function renderDoughnutChart(canvasId, dataObj) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const labels = Object.keys(dataObj);
    const data = Object.values(dataObj);

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#4f8ef7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#8b92b8', font: { size: 11 } } }
        }
      }
    });
}

let chartIngresos, chartServicios;
let isDeleteMode = false;
let selectedIds = new Set();

const MAPPING = {
  nombre: ['Nombre', 'Nombre del Cliente', 'Nombre del Proyecto', 'Nombre/Tema', 'Actividad/Tema', 'Nombre del Contacto'],
  correo: ['Correo', 'Correo Electrónico'],
  telefono: ['Teléfono', 'Teléfono Principal'],
  notas: ['Notas', 'Notas sobre el Cliente', 'Resultado', 'Resultados / Comentarios'],
  empresa: ['Empresa', 'Empresa o Razón Social'],
  estado: ['Estado'],
  estatus: ['Estatus'],
  ejecutivo: ['Ejecutivo', 'Ejecutivo asignado'],
  servicios: ['Servicios', 'Servicios contratados', 'Tipo de Servicio'],
  servicio: ['Servicio', 'Tipo de Servicio', 'Servicios contratados'],
  valormensual: ['Valor mensual'],
  prioridad: ['Prioridad'],
  renovacion: ['Fecha próxima renovación'],
  direccion: ['Dirección'],
  idcliente: ['Cliente Relacionado', 'ID Cliente'],
  asesor: ['Asesor Responsable', 'Responsable'],
  etapa: ['Etapa'],
  fechainicio: ['Fecha Inicio'],
  fechafin: ['Fecha Fin'],
  riesgo: ['Riesgo'],
  tarea: ['Tarea'],
  categoria: ['Categoría'],
  descripcion: ['Descripción', 'Descripcion'],
  metodo: ['Método de Pago', 'Metodo de Pago'],
  idproyecto: ['ID Proyecto'],
  fechalimite: ['Fecha límite'],
  responsable: ['Responsable', 'Asesor Responsable'],
  fecha: ['Fecha de la Cita', 'Fecha'],
  hora: ['Hora de la Cita', 'Hora'],
  tipo: ['Tipo de reunión', 'Tipo'],
  resultado: ['Resultado'],
  actividad: ['Actividad/Tema'],
  horas: ['Horas Invertidas'],
  minutos: ['Minutos'],
  comentarios: ['Comentarios'],
  fecharegistro: ['Fecha de Registro'],
  situacion: ['Situacion'],
  problema: ['Problema'],
  implicacion: ['Implicacion'],
  necesidad: ['Necesidad'],
  giro: ['Giro'],
  cliente: ['Cliente'],
  fecha: ['Fecha'],
  vencimiento: ['Vencimiento'],
  concepto: ['Concepto'],
  monto: ['Monto'],
  impuesto: ['Impuesto'],
  total: ['Total'],
  proyecto: ['Proyecto']
};

const GIROS_INDUSTRIA = [
  'Agricultura y agroindustria',
  'Alimentos y bebidas',
  'Automotriz',
  'Comercio y retail',
  'Construccion',
  'Consultoria',
  'Educacion',
  'Energia',
  'Entretenimiento',
  'Finanzas y seguros',
  'Gobierno',
  'Inmobiliaria',
  'Manufactura',
  'Marketing y publicidad',
  'Medios y comunicacion',
  'Medicina y salud',
  'Moda y belleza',
  'Organizacion sin fines de lucro',
  'Restaurantes y hospitalidad',
  'Servicios profesionales',
  'SaaS y software',
  'Tecnologia',
  'Telecomunicaciones',
  'Transporte y logistica',
  'Turismo',
  'Otro'
];

function giroOptions(selectedValue = '') {
  return GIROS_INDUSTRIA.map(giro => `<option value="${escapeDetailHtml(giro)}" ${String(giro) === String(selectedValue) ? 'selected' : ''}>${escapeDetailHtml(giro)}</option>`).join('');
}

const ETAPAS_MAP = {
  '1': '1 → Activación',
  '2': '2 → Diagnóstico',
  '3': '3 → Calendario de Contenido',
  '4': '4 → Creación de Contenido',
  '5': '5 → Campaña',
  '6': '6 → Reporte de Resultados',
  '7': '<i class="ph-bold ph-arrows-clockwise" style="vertical-align:middle; margin-right:4px;"></i> Renovación'
};

function formatEtapa(val) {
  const stage = window.pipelineConfigs?.proyectos?.stages?.find(item => [item.legacy_value, item.stage_key, item.name].map(String).includes(String(val)));
  return stage?.name || ETAPAS_MAP[String(val)] || val || '—';
}

// ── NAV ──────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const section = item.dataset.section;
    navigateTo(section);
  });
});

function toggleDeleteMode() {
  if (selectedIds.size > 0) {
    executeBulkDelete();
    return;
  }
  
  isDeleteMode = !isDeleteMode;
  
  const btn = document.getElementById('btnDeleteMode');
  const txt = document.getElementById('textDeleteMode');
  const main = document.querySelector('.main-content');
  
  if (isDeleteMode) {
    main.classList.add('delete-mode-active');
    btn.style.background = '#fee2e2';
    btn.style.color = '#b91c1c';
    btn.style.borderColor = '#fecaca';
    txt.textContent = 'Confirmar (0)';
  } else {
    main.classList.remove('delete-mode-active');
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    txt.textContent = 'Eliminar';
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
  }
}

function toggleSelection(id, isChecked) {
  if (isChecked) selectedIds.add(id);
  else selectedIds.delete(id);
  
  if (isDeleteMode) {
    document.getElementById('textDeleteMode').textContent = `Confirmar (${selectedIds.size})`;
  } else if (selectedIds.size > 0) {
    // Auto-enter delete mode visually if they check something
    isDeleteMode = true;
    const btn = document.getElementById('btnDeleteMode');
    const txt = document.getElementById('textDeleteMode');
    const main = document.querySelector('.main-content');
    main.classList.add('delete-mode-active');
    btn.style.background = '#fee2e2';
    btn.style.color = '#b91c1c';
    btn.style.borderColor = '#fecaca';
    txt.textContent = `Confirmar (${selectedIds.size})`;
  }
}

async function executeBulkDelete() {
  if (!confirm(`¿Estás seguro de eliminar ${selectedIds.size} registros? Esta acción no se puede deshacer.`)) return;
  
  document.getElementById('btnDeleteMode').disabled = true;
  document.getElementById('textDeleteMode').textContent = 'Eliminando...';
  
  const endpoint = currentSection === 'tableros'
    ? ({ pipeline: 'proyectos', 'pipeline-prospectos': 'prospectos', tareas: 'tareas' }[currentTablero] || 'tareas')
    : (currentSection === 'pipeline' ? 'pipeline_de_proyecto' : currentSection);
  
  let successCount = 0;
  for (const id of selectedIds) {
    try {
      const res = await fetch(`${API}/api/${endpoint}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) successCount++;
    } catch(e) { console.error(e); }
  }
  
  showToast(`<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i> Se eliminaron ${successCount} registros.`);
  document.getElementById('btnDeleteMode').disabled = false;
  
  selectedIds.clear();
  if (isDeleteMode) toggleDeleteMode();
  refreshData();
}

function navigateTo(section) {
  currentSection = section;
  window.aiCommunicationContext = null;
  window.aiCommunicationHistory = [];
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${section}`)?.classList.remove('hidden');
  document.getElementById(`nav-${section}`)?.classList.add('active');
  
  const hasOwnCreateControl = ['actividades', 'pagos_gastos', 'correos', 'agent', 'playground', 'chats', 'analiticas', 'integraciones'].includes(section);
  const addLabels = {
    prospectos: '+ Nuevo prospecto',
    clientes: '+ Convertir prospecto',
    proyectos: '+ Nuevo proyecto',
    citas: 'Agendar cita',
    cotizaciones: '+ Nueva cotización',
    archivos: 'Subir archivo'
  };
  const btnAdd = document.getElementById('btnAdd');
  btnAdd.innerHTML = addLabels[section] || '+ Nuevo registro';
  btnAdd.style.display = (section === 'dashboard' || section === 'tableros' || hasOwnCreateControl) ? 'none' : 'inline-block';
  document.getElementById('btnDeleteMode').style.display = ['dashboard', 'agent', 'playground', 'chats', 'analiticas', 'integraciones'].includes(section) ? 'none' : 'inline-block';
  if (isDeleteMode) toggleDeleteMode();

  const titles = {
    dashboard: ['Dashboard', 'Vista general del negocio'],
    agent: ['Agente de Chat', 'Inteligencia comercial y automatización'],
    playground: ['Playground', 'Prueba instrucciones y tools del agente'],
    chats: ['Chats', 'Bandeja compartida de conversaciones'],
    prospectos: ['Contactos', 'Contactos y prospectos del negocio'],
    clientes: ['Clientes', 'Base de clientes activos'],
    proyectos: ['Proyectos', 'Control de proyectos activos'],
    tableros: ['Embudo', 'Etapas comerciales y oportunidades'],
    citas: ['Calendarios', 'Disponibilidad y citas del equipo'],
    actividades: ['Indicadores diarios', 'Registra llamadas, contenido y avances del día'],
    cotizaciones: ['Cotizador', 'Cotizaciones, planes y documentos comerciales'],
    archivos: ['Archivos', 'Documentos y archivos del negocio'],
    pagos_gastos: ['Pagos y Gastos', 'Control de ingresos y egresos'],
    correos: ['Correos', 'Campañas por Gmail para prospectos'],
    analiticas: ['Analíticas', 'Conversaciones, citas y conversiones'],
    integraciones: ['Integraciones', 'Canales y servicios conectados'],
  };
  const [title, sub] = titles[section] || ['', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSub').textContent = sub;
  
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.add('hidden');
  }

  loadSection(section);
}

async function refreshData() {
  loadSection(currentSection);
  showToast('<i class="ph-bold ph-arrows-clockwise" style="vertical-align:middle; margin-right:4px;"></i> Datos actualizados');
}

// ── DATE FILTER LOGIC ───────────────────────────────────────────
let globalDateStart = '';
let globalDateEnd = '';

function openDateFilter() {
  document.getElementById('filterDateStart').value = globalDateStart;
  document.getElementById('filterDateEnd').value = globalDateEnd;
  document.getElementById('dateFilterModal').classList.remove('hidden');
}

function closeDateFilter() {
  document.getElementById('dateFilterModal').classList.add('hidden');
}

function applyDateFilter() {
  globalDateStart = document.getElementById('filterDateStart').value;
  globalDateEnd = document.getElementById('filterDateEnd').value;
  closeDateFilter();
  refreshData();
}

function clearDateFilter() {
  globalDateStart = '';
  globalDateEnd = '';
  document.getElementById('filterDateStart').value = '';
  document.getElementById('filterDateEnd').value = '';
  closeDateFilter();
  refreshData();
}

function filterByDate(dataArray) {
  if (!globalDateStart && !globalDateEnd) return dataArray;
  
  const sTime = globalDateStart ? new Date(globalDateStart + 'T00:00:00').getTime() : 0;
  const eTime = globalDateEnd ? new Date(globalDateEnd + 'T23:59:59').getTime() : Infinity;

  return dataArray.filter(r => {
    const d = r['Fecha de Registro'] || r['Fecha de la Cita'] || r['Fecha Inicio'] || r['Fecha'];
    if (!d || d.trim() === '' || d === '—') return true;
    const dTime = new Date(d + 'T12:00:00').getTime();
    return dTime >= sTime && dTime <= eTime;
  });
}

// ── MOBILE MENU ──────────────────────────────────────────────────
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('hidden');
});

document.getElementById('sidebarOverlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
});

// ── WAHA SHARED INBOX ─────────────────────────────────────────────
const V2_TOKEN_KEY = 'erp_v2_token';
let wahaConversations = [];
let activeWahaConversation = null;
let wahaFilter = 'all';
let wahaPollTimer = null;

function v2Headers(extra = {}) {
  const token = localStorage.getItem(V2_TOKEN_KEY);
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function v2Fetch(path, options = {}) {
  const response = await fetch(path, { ...options, headers: v2Headers(options.headers || {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setWahaStatus(text, detail, connected = false) {
  const dot = document.getElementById('wahaStatusDot');
  const label = document.getElementById('wahaStatusText');
  const sub = document.getElementById('wahaStatusDetail');
  if (dot) dot.className = `status-dot ${connected ? '' : 'status-dot-muted'}`;
  if (label) label.textContent = text;
  if (sub) sub.textContent = detail;
}

async function loadChats() {
  const loginButton = document.getElementById('wahaLoginButton');
  try {
    const status = await v2Fetch('/api/v2/waha/status');
    loginButton?.style.setProperty('display', 'none');
    document.getElementById('wahaStartButton').style.display = status.session?.status === 'WORKING' ? 'none' : 'inline-flex';
    document.getElementById('wahaQrButton').style.display = ['SCAN_QR_CODE', 'STARTING'].includes(status.session?.status) ? 'inline-flex' : 'none';
    setWahaStatus(status.configured ? `WAHA: ${status.session?.status || 'configurado'}` : 'WAHA no configurado', status.configured ? 'La sesión está conectada al CRM.' : 'Configura WAHA_BASE_URL en las variables del servidor.', status.session?.status === 'WORKING');
    const result = await v2Fetch('/api/v2/conversations?limit=100');
    wahaConversations = result.data || [];
    renderWahaConversations();
    if (activeWahaConversation) selectWahaConversation(activeWahaConversation.id);
    if (!wahaPollTimer) wahaPollTimer = setInterval(() => { if (currentSection === 'chats') loadChats(); }, 10000);
  } catch (error) {
    if (error.status === 401) {
      if (loginButton) loginButton.style.display = 'inline-flex';
      setWahaStatus('Sesión del CRM requerida', 'Inicia sesión para consultar la bandeja compartida.', false);
    } else {
      setWahaStatus('WAHA no disponible', error.message, false);
    }
  }
}

async function loginV2() {
  const email = window.prompt('Correo del administrador del ERP:');
  if (!email) return;
  const password = window.prompt('Contraseña:');
  if (!password) return;
  try {
    const result = await fetch('/api/v2/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión');
      return data;
    });
    localStorage.setItem(V2_TOKEN_KEY, result.token);
    showToast('<i class="ph-fill ph-check-circle" style="color:#10b981"></i> Sesión del CRM iniciada');
    loadChats();
  } catch (error) { showToast(`<i class="ph-fill ph-x-circle" style="color:#ef4444"></i> ${error.message}`); }
}

function escapeWahaHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function renderWahaConversations() {
  const search = String(document.getElementById('wahaSearch')?.value || '').toLowerCase();
  const rows = wahaConversations.filter(item => (wahaFilter === 'all' || item.status === wahaFilter) && `${item.contact_name} ${item.phone_e164}`.toLowerCase().includes(search));
  document.getElementById('wahaConversationCount').textContent = rows.length;
  const list = document.getElementById('wahaConversationList');
  if (!rows.length) {
    list.innerHTML = '<div class="inbox-empty"><i class="ph ph-chat-circle-dots"></i><span>No se encontraron chats</span><small>Los mensajes de WAHA aparecerán aquí.</small></div>';
    return;
  }
  list.innerHTML = rows.map(item => `<button class="waha-conversation-item ${activeWahaConversation?.id === item.id ? 'active' : ''}" onclick="selectWahaConversation('${item.id}')"><span class="waha-contact-avatar">${escapeWahaHtml((item.contact_name || '?').slice(0, 1).toUpperCase())}</span><span class="waha-conversation-copy"><strong>${escapeWahaHtml(item.contact_name || item.phone_e164)}</strong><small>${escapeWahaHtml(item.channel || 'whatsapp')} · ${escapeWahaHtml(item.status || 'new')}</small></span><time>${item.last_activity_at ? new Date(item.last_activity_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time></button>`).join('');
}

function setWahaFilter(filter) { wahaFilter = filter; renderWahaConversations(); }
async function refreshWahaChats() { await loadChats(); showToast('<i class="ph-bold ph-arrows-clockwise"></i> Chats actualizados'); }

async function selectWahaConversation(id) {
  activeWahaConversation = wahaConversations.find(item => item.id === id) || null;
  renderWahaConversations();
  if (!activeWahaConversation) return;
  document.getElementById('wahaThread').classList.remove('hidden');
  document.getElementById('wahaThreadEmpty').classList.add('hidden');
  document.getElementById('wahaThreadName').textContent = activeWahaConversation.contact_name || activeWahaConversation.phone_e164;
  document.getElementById('wahaThreadPhone').textContent = activeWahaConversation.phone_e164 || '';
  document.getElementById('wahaContactDetails').innerHTML = `<i class="ph ph-user-circle"></i><strong>${escapeWahaHtml(activeWahaConversation.contact_name || 'Contacto')}</strong><small>${escapeWahaHtml(activeWahaConversation.phone_e164 || '')}</small><span class="soft-badge gray">Etapa: ${escapeWahaHtml(activeWahaConversation.pipeline_stage || 'new')}</span>`;
  try {
    const result = await v2Fetch(`/api/v2/conversations/${encodeURIComponent(id)}/messages?limit=200`);
    const messages = result.data || [];
    document.getElementById('wahaMessages').innerHTML = messages.length ? messages.map(message => `<div class="waha-message ${message.direction === 'outbound' ? 'outbound' : 'inbound'}"><div>${escapeWahaHtml(message.body).replace(/\n/g, '<br>')}</div><time>${new Date(message.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('') : '<div class="waha-message-empty">No hay mensajes guardados todavía.</div>';
    const container = document.getElementById('wahaMessages');
    container.scrollTop = container.scrollHeight;
  } catch (error) { showToast(`<i class="ph-fill ph-x-circle" style="color:#ef4444"></i> ${error.message}`); }
}

async function sendWahaMessage(event) {
  event.preventDefault();
  if (!activeWahaConversation) return;
  const input = document.getElementById('wahaMessageInput');
  const body = input.value.trim();
  if (!body) return;
  const button = event.submitter;
  button.disabled = true;
  try {
    await v2Fetch('/api/v2/waha/send', { method: 'POST', body: JSON.stringify({ conversation_id: activeWahaConversation.id, body }) });
    input.value = '';
    await selectWahaConversation(activeWahaConversation.id);
  } catch (error) { showToast(`<i class="ph-fill ph-x-circle" style="color:#ef4444"></i> ${error.message}`); }
  finally { button.disabled = false; }
}

async function startWahaSession() {
  try { await v2Fetch('/api/v2/waha/session/start', { method: 'POST', body: '{}' }); showToast('<i class="ph-fill ph-check-circle" style="color:#10b981"></i> Sesión WAHA iniciada'); await loadChats(); }
  catch (error) { showToast(`<i class="ph-fill ph-x-circle" style="color:#ef4444"></i> ${error.message}`); }
}

async function showWahaQr() {
  try {
    const result = await v2Fetch('/api/v2/waha/qr');
    const qr = result.data;
    if (qr?.data) window.open(`data:${qr.mimetype || 'image/png'};base64,${qr.data}`, '_blank', 'noopener');
    else showToast('WAHA no devolvió un QR todavía.');
  } catch (error) { showToast(`<i class="ph-fill ph-x-circle" style="color:#ef4444"></i> ${error.message}`); }
}

function loadAgent() {}
function loadAnalyticsOverview() {}
function loadIntegrations() {}

// ── LOAD SECTION ─────────────────────────────────────────────────
function loadSection(section) {
  // Bug 09: Limpiar selección al cambiar de pestaña
  selectedIds.clear();
  isDeleteMode = false;
  
  const loaders = {
    dashboard: loadDashboard,
    agent: loadAgent,
    playground: loadAgent,
    chats: loadChats,
    analiticas: loadAnalyticsOverview,
    integraciones: loadIntegrations,
    prospectos: loadProspectos,
    clientes: loadClientes,
    proyectos: loadProyectos,
    tableros: loadTableros,
    citas: loadCitas,
    actividades: loadActividades,
    cotizaciones: loadCotizaciones,
    archivos: loadArchivos,
    pagos_gastos: loadPagosGastos,
    correos: loadCorreos,
  };
  loaders[section]?.();
}

async function setTodayDate() {
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json());
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('act-fecha');
  if (el) el.value = today;
  
  // Update hardcoded select if present
  const respSelect = document.getElementById('act-responsable');
  if (respSelect && respSelect.tagName === 'INPUT') {
    const parent = respSelect.parentNode;
    const select = document.createElement('select');
    select.id = 'act-responsable';
    select.name = 'responsable';
    select.innerHTML = '<option value="">Selecciona Asesor...</option>' + generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor');
    parent.replaceChild(select, respSelect);
  }
}

// ── PROSPECTOS ───────────────────────────────────────────────────
window.prospectosData = [];
async function loadProspectos() {
  const asesoresRequest = Array.isArray(window.asesoresData)
    ? Promise.resolve(window.asesoresData)
    : fetch(`${API}/api/asesores`).then(r => r.json());
  const [asesores, prospectos] = await Promise.all([
    asesoresRequest,
    fetch(`${API}/api/prospectos`).then(r => r.json())
  ]);
  window.asesoresData = asesores;
  window.prospectosData = prospectos;
  const data = filterByDate(window.prospectosData);

  // ── Botón de Campaña movido a index.html estático ──────────

  const tbody = document.querySelector('#tableProspectos tbody');
  tbody.innerHTML = data.length ? data.map(r => `
    <tr class="clickable-row" onclick="viewRecord('prospectos', '${r['ID Prospectos'] || ''}')">
      <td><input type="checkbox" class="row-checkbox" value="${r['ID Prospectos'] || ''}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-purple">${r['ID Prospectos'] || '—'}</span></td>
      <td><strong>${r['Nombre del Contacto'] || '—'}</strong></td>
      <td>${r['Correo Electrónico'] || '—'}</td>
      <td>${r['Teléfono'] || '—'}</td>
      <td><span class="badge badge-gray">${escapeDetailHtml(r['Giro'] || '—')}</span></td>
      <td><span class="badge badge-blue">${r['Medio de contacto'] || '—'}</span></td>
      <td>${r['Fecha de Registro'] || '—'}</td>
      <td title="${r['Notas'] || ''}">${truncate(r['Notas'], 40)}</td>
      <td>${r['Asesor'] || '—'}</td>
      <td>${r['Situacion'] || '—'}</td>
      <td>${r['Problema'] || '—'}</td>
      <td>${r['Implicacion'] || '—'}</td>
      <td>${r['Necesidad'] || '—'}</td>
    </tr>`).join('') : emptyState();
}

// ── CLIENTES ─────────────────────────────────────────────────────
window.clientesData = [];
async function loadClientes() {
  window.clientesData = await fetch(`${API}/api/clientes`).then(r => r.json());
  const data = filterByDate(window.clientesData);
  const tbody = document.querySelector('#tableClientes tbody');
  tbody.innerHTML = data.length ? data.map(r => `
    <tr class="clickable-row" onclick="viewRecord('clientes', '${r['ID Clientes'] || ''}')">
      <td><input type="checkbox" class="row-checkbox" value="${r['ID Clientes'] || ''}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-blue">${r['ID Clientes'] || '—'}</span></td>
      <td><strong>${r['Nombre del Cliente'] || '—'}</strong></td>
      <td>${r['Empresa o Razón Social'] || '—'}</td>
      <td>${r['Correo Electrónico'] || '—'}</td>
      <td>${r['Teléfono Principal'] || '—'}</td>
      <td>${statusBadge(r['Estado'])}</td>
      <td>${r['Servicios contratados'] || '—'}</td>
      <td>${r['Valor mensual'] ? '$' + parseFloat(r['Valor mensual']).toLocaleString() : '—'}</td>
      <td>${priorityBadge(r['Prioridad'])}</td>
      <td>${r['Giro'] || '—'}</td>
    </tr>`).join('') : emptyState();
}

// ── PROYECTOS ────────────────────────────────────────────────────
window.proyectosData = [];
async function loadProyectos() {
  if (!window.citasData || window.citasData.length === 0) {
    try { window.citasData = await fetch(`${API}/api/citas`).then(r => r.json()); } catch(e) {}
  }
  window.proyectosData = await fetch(`${API}/api/proyectos`).then(r => r.json());
  const projectPipeline = await loadPipelineConfig('proyectos');
  const data = filterByDate(window.proyectosData);

  // ── Botón de Reporte movido a index.html estático ────────────

  const tbody = document.querySelector('#tableProyectos tbody');
  tbody.innerHTML = data.length ? data.map(r => {
    const avance = parseInt(r['% Avance Real']) || 0;
    
    let clientName = r['Cliente Relacionado'] || '—';
    if (clientName.startsWith('CLI-') && window.clientesData) {
      const c = window.clientesData.find(x => x['ID Clientes'] === clientName);
      if (c) clientName = c['Nombre del Cliente'] || clientName;
    }
    
    const estadoClase = { 'Activo': 'pill-estado-activo', 'Reunión': 'pill-estado-reunion', 'Detenido': 'pill-estado-reunion', 'Cerrado': 'pill-estado-cerrado' }[r['Estado del Proyecto']] || 'pill-estado-default';
    const prioClase   = { 'Alta': 'pill-prioridad-alta', 'Media': 'pill-prioridad-media', 'Baja': 'pill-prioridad-baja' }[r['Prioridad']] || 'pill-prioridad-media';
    const riesgoClase = { 'Alto': 'pill-riesgo-alto', 'Medio': 'pill-riesgo-medio', 'Bajo': 'pill-riesgo-bajo' }[r['Riesgo']] || 'pill-riesgo-bajo';

    let nextMeeting = r['Próxima reunión'] || '—';
    if (window.citasData && window.citasData.length > 0) {
      const projectCitas = window.citasData.filter(c => c['ID Proyecto'] === r['ID Proyectos'] && (c['Fecha de la Cita'] || c['Fecha']));
      if (projectCitas.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        let mappedCitas = projectCitas.map(c => {
           let d = c['Fecha de la Cita'] || c['Fecha'];
           let standardDate = d;
           if (d && d.includes('/')) {
             const parts = d.split('/');
             if (parts.length === 3) standardDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
           }
           return { originalDate: d, standardDate };
        });

        const upcoming = mappedCitas.filter(c => c.standardDate >= todayStr).sort((a,b) => a.standardDate.localeCompare(b.standardDate));
        if (upcoming.length > 0) {
          nextMeeting = upcoming[0].originalDate;
        } else {
          mappedCitas.sort((a,b) => b.standardDate.localeCompare(a.standardDate));
          nextMeeting = mappedCitas[0].originalDate;
        }
      }
    }

    return `<tr class="clickable-row" onclick="viewRecord('proyectos', '${r['ID Proyectos'] || ''}')">
      <td><input type="checkbox" class="row-checkbox" value="${r['ID Proyectos'] || ''}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-purple">${r['ID Proyectos'] || '—'}</span></td>
      <td><strong>${r['Nombre del Proyecto'] || '—'}</strong></td>
      <td>${clientName}</td>
      <td>${r['Servicio'] || '—'}</td>
      <td style="white-space:nowrap; font-weight:600; color:var(--text2);">${nextMeeting}</td>
      <td>
        <select class="pill-select ${estadoClase}" onclick="event.stopPropagation()" onchange="updateProyectoSelect('${r['ID Proyectos']}','estado','Estado del Proyecto',this.value); this.className='pill-select '+({'Activo':'pill-estado-activo','Reunión':'pill-estado-reunion','Cerrado':'pill-estado-cerrado'}[this.value]||'pill-estado-default')">
          <option value="Activo"  ${r['Estado del Proyecto'] === 'Activo'  ? 'selected' : ''}>Activo</option>
          <option value="Reunión" ${r['Estado del Proyecto'] === 'Reunión' || r['Estado del Proyecto'] === 'Detenido' ? 'selected' : ''}>Reunión</option>
          <option value="Cerrado" ${r['Estado del Proyecto'] === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
        </select>
      </td>
      <td>
        <select class="pill-select pill-etapa" onclick="event.stopPropagation()" onchange="updateProyectoSelect('${r['ID Proyectos']}','etapa','Etapa actual',this.value)">
          ${pipelineStageOptions('proyectos', r['Etapa actual'])}
        </select>
      </td>
       <td><div style="font-weight:700;color:#3b82f6;">${pipelineProgress(projectPipeline, r['Etapa actual'])}%</div></td>
      <td>
        <select class="pill-select ${prioClase}" onclick="event.stopPropagation()" onchange="updateProyectoSelect('${r['ID Proyectos']}','prioridad','Prioridad',this.value); this.className='pill-select '+({'Alta':'pill-prioridad-alta','Media':'pill-prioridad-media','Baja':'pill-prioridad-baja'}[this.value]||'pill-prioridad-media')">
          <option value="Alta"  ${r['Prioridad'] === 'Alta'  ? 'selected' : ''}>Alta</option>
          <option value="Media" ${r['Prioridad'] === 'Media' ? 'selected' : ''}>Media</option>
          <option value="Baja"  ${r['Prioridad'] === 'Baja'  ? 'selected' : ''}>Baja</option>
        </select>
      </td>
      <td>
        <select class="pill-select ${riesgoClase}" onclick="event.stopPropagation()" onchange="updateProyectoSelect('${r['ID Proyectos']}','riesgo','Riesgo',this.value); this.className='pill-select '+({'Alto':'pill-riesgo-alto','Medio':'pill-riesgo-medio','Bajo':'pill-riesgo-bajo'}[this.value]||'pill-riesgo-bajo')">
          <option value="Alto"  ${r['Riesgo'] === 'Alto'  ? 'selected' : ''}>Alto</option>
          <option value="Medio" ${r['Riesgo'] === 'Medio' ? 'selected' : ''}>Medio</option>
          <option value="Bajo"  ${r['Riesgo'] === 'Bajo'  ? 'selected' : ''}>Bajo</option>
        </select>
      </td>
    </tr>`;
  }).join('') : emptyState();
}

async function updateProyectoSelect(id, payloadKey, memKey, val) {
  try {
    const record = window.proyectosData.find(r => Object.values(r).includes(id));
    const pipeline = window.pipelineConfigs.proyectos;
    const targetStage = payloadKey === 'etapa' ? pipelineStageForValue(pipeline, val) : null;
    if (payloadKey === 'etapa' && targetStage) {
      await transitionPipelineRecord('proyectos', 'proyectos', id, targetStage.stage_id, 'project_table');
    } else {
      const res = await fetch(`${API}/api/proyectos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [payloadKey]: val }) });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || `Error al actualizar ${payloadKey}`); }
    }
    showToast('Actualizado correctamente');
    
    // Update memory
    if (record) record[memKey] = val;

    loadProyectos(); // re-render table
  } catch(err) {
    showToast(err.message, true);
    loadProyectos(); // revert changes if error
  }
}

async function openReporteModal() {
  if (!window.proyectosData || !window.proyectosData.length) {
    window.proyectosData = await fetch(`${API}/api/proyectos`).then(r => r.json()).catch(() => []);
  }
  const selectedProject = selectedIds.size === 1 ? [...selectedIds][0] : '';
  const options = (window.proyectosData || []).map(p => `<option value="${p['ID Proyectos'] || ''}" ${p['ID Proyectos'] === selectedProject ? 'selected' : ''}>${p['ID Proyectos'] || ''} - ${p['Nombre del Proyecto'] || 'Sin nombre'}</option>`).join('');
  openModal('Reporte integral de proyecto', `<form onsubmit="generateProjectReport(event)">
    <div class="form-group">
      <label>Selecciona el proyecto</label>
      <select name="projectId" required>
        <option value="">Seleccionar...</option>${options}
      </select>
    </div>
    <p class="text-muted" style="margin:12px 0;">El reporte consultará registros relacionados de tareas, etapas, citas, actividades, archivos, cotizaciones, cliente y pagos/gastos.</p>
    <button type="submit" class="btn btn-primary btn-block"><i class="ph ph-file-pdf"></i> Generar reporte PDF</button>
  </form>`);
}

async function fetchReportData(endpoint) {
  try {
    const response = await fetch(`${API}/api/${endpoint}`);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function reportText(record) {
  return Object.values(record || {}).filter(Boolean).join(' ').toLowerCase();
}

function relatedProjectRecords(records, project, client) {
  const projectId = String(project['ID Proyectos'] || '').toLowerCase();
  const projectName = String(project['Nombre del Proyecto'] || '').toLowerCase();
  const clientId = String(project['Cliente Relacionado'] || '').toLowerCase();
  const clientName = String(client?.['Nombre del Cliente'] || client?.['Nombre'] || '').toLowerCase();
  const tokens = [projectId, projectName, clientId, clientName].filter(value => value.length >= 3);
  return records.filter(record => {
    const direct = ['ID Proyecto', 'ID Proyectos', 'Proyecto', 'Proyecto ID', 'ID Proyecto Relacionado']
      .some(key => [projectId, projectName].includes(String(record[key] || '').toLowerCase()));
    const text = reportText(record);
    return direct || tokens.some(token => text.includes(token));
  });
}

async function generateProjectReport(event) {
  event.preventDefault();
  const projectId = new FormData(event.target).get('projectId');
  if (!projectId) return;

  const endpoints = ['proyectos', 'clientes', 'tareas', 'pipeline_de_proyecto', 'citas', 'actividades', 'archivos', 'cotizaciones', 'pagos_gastos'];
  const [projects, clients, tasks, pipeline, meetings, activities, files, quotes, finance] = await Promise.all(endpoints.map(fetchReportData));
  const project = projects.find(item => item['ID Proyectos'] === projectId) || (window.proyectosData || []).find(item => item['ID Proyectos'] === projectId);
  if (!project) {
    showToast('No se encontró el proyecto seleccionado', true);
    return;
  }

  const client = clients.find(item => item['ID Clientes'] === project['Cliente Relacionado']);
  const report = {
    project,
    client,
    tasks: relatedProjectRecords(tasks, project, client),
    pipeline: relatedProjectRecords(pipeline, project, client),
    meetings: relatedProjectRecords(meetings, project, client),
    activities: relatedProjectRecords(activities, project, client),
    files: relatedProjectRecords(files, project, client),
    quotes: relatedProjectRecords(quotes, project, client),
    finance: relatedProjectRecords(finance, project, client)
  };
  window.currentProjectReport = report;
  downloadProjectReportPDF(report);
  renderProjectReport(report);
}

function reportMoney(value) {
  const amount = Number(String(value || 0).replace(/[^0-9.-]/g, '')) || 0;
  return '$' + amount.toLocaleString();
}

function reportRows(records, fields) {
  return records.slice(0, 25).map(record => fields.map(field => record[field] || '—'));
}

function renderProjectReport(report) {
  const p = report.project;
  const clientName = report.client?.['Nombre del Cliente'] || p['Cliente Relacionado'] || 'Sin cliente';
  const expenses = report.finance.filter(r => r['Tipo'] === 'Gasto').reduce((sum, r) => sum + (Number(r['Monto']) || 0), 0);
  const income = report.finance.filter(r => ['Ingreso', 'Pago'].includes(r['Tipo'])).reduce((sum, r) => sum + (Number(r['Monto']) || 0), 0);
  const openTasks = report.tasks.filter(r => !['Terminado', 'Completado', 'Cerrado'].includes(r['Estado'])).length;
  const blockers = report.tasks.filter(r => ['Bloqueado', 'Detenido', 'Vencida'].includes(r['Estado']));
  const risk = p['Riesgo'] || 'No definido';

  const table = (title, headers, rows) => `<div style="margin-top:18px;"><h3 style="margin-bottom:8px;">${title} <span class="badge badge-gray">${rows.length}</span></h3>${rows.length ? `<div style="overflow:auto;"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="text-muted">Sin registros relacionados.</p>'}</div>`;

  const body = `<div id="projectReportContent">
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;">
      <div><h2>${p['Nombre del Proyecto'] || 'Proyecto'}</h2><p class="text-muted">${p['ID Proyectos'] || '—'} · Cliente: ${clientName}</p></div>
      <button class="btn btn-primary" onclick="downloadProjectReportPDF(window.currentProjectReport)"><i class="ph ph-file-pdf"></i> Descargar PDF</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:16px;">
      <div class="kpi-card"><div class="kpi-value">${p['Estado del Proyecto'] || '—'}</div><div class="kpi-label">Estado</div></div>
      <div class="kpi-card"><div class="kpi-value">${p['Etapa actual'] || '—'}</div><div class="kpi-label">Etapa</div></div>
      <div class="kpi-card"><div class="kpi-value">${openTasks}</div><div class="kpi-label">Tareas abiertas</div></div>
      <div class="kpi-card"><div class="kpi-value">${reportMoney(income)}</div><div class="kpi-label">Ingresos relacionados</div></div>
      <div class="kpi-card"><div class="kpi-value">${reportMoney(expenses)}</div><div class="kpi-label">Gastos relacionados</div></div>
    </div>
    <div style="margin-top:18px;"><strong>Riesgo:</strong> ${risk} · <strong>Prioridad:</strong> ${p['Prioridad'] || 'No definida'}<br><strong>Notas:</strong> ${p['Notas'] || 'Sin notas'}</div>
    ${blockers.length ? `<div style="margin-top:14px;background:#fef2f2;padding:12px;border-radius:8px;color:#991b1b;"><strong>Bloqueos detectados:</strong> ${blockers.map(r => r['Tarea'] || r['Estado']).join(', ')}</div>` : ''}
    ${table('Tareas', ['ID', 'Tarea', 'Estado', 'Responsable', 'Fecha límite'], reportRows(report.tasks, ['ID Tarea', 'Tarea', 'Estado', 'Responsable', 'Fecha límite']))}
    ${table('Etapas y pipeline', ['Proyecto', 'Etapa', 'Estado', 'Responsable', 'Comentarios'], reportRows(report.pipeline, ['ID Proyecto', 'Etapa', 'Estado', 'Responsable', 'Comentarios']))}
    ${table('Citas y reuniones', ['Fecha', 'Hora', 'Tipo', 'Responsable', 'Resultado'], reportRows(report.meetings, ['Fecha', 'Hora', 'Tipo', 'Responsable', 'Resultado']))}
    ${table('Actividades e indicadores', ['Fecha', 'Indicador', 'Cantidad', 'Responsable', 'Notas'], reportRows(report.activities, ['Fecha', 'Indicador', 'Cantidad', 'Responsable', 'Notas']))}
    ${table('Archivos y entregables', ['Nombre', 'Tipo', 'Proyecto', 'Cliente', 'Fecha'], reportRows(report.files, ['Nombre del Archivo', 'Tipo', 'Proyecto', 'Cliente', 'Fecha Subida']))}
    ${table('Cotizaciones', ['ID', 'Cliente', 'Fecha', 'Estado', 'Total'], reportRows(report.quotes, ['ID Cotización', 'Cliente', 'Fecha', 'Estado', 'Total']))}
    ${table('Pagos e ingresos relacionados', ['ID', 'Tipo', 'Fecha', 'Descripción', 'Monto'], reportRows(report.finance, ['ID', 'Tipo', 'Fecha', 'Descripción', 'Monto']))}
  </div>`;
  openModal(`Reporte: ${p['Nombre del Proyecto'] || p['ID Proyectos']}`, body);
}

function downloadProjectReportPDF(report) {
  if (!report) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const p = report.project;
  const width = doc.internal.pageSize.getWidth();
  const income = report.finance.filter(r => ['Ingreso', 'Pago'].includes(r['Tipo'])).reduce((sum, r) => sum + (Number(r['Monto']) || 0), 0);
  const expenses = report.finance.filter(r => r['Tipo'] === 'Gasto').reduce((sum, r) => sum + (Number(r['Monto']) || 0), 0);
  doc.setFontSize(18); doc.text('Reporte integral de proyecto', width / 2, 14, { align: 'center' });
  doc.setFontSize(12); doc.text(`${p['Nombre del Proyecto'] || 'Proyecto'} (${p['ID Proyectos'] || '—'})`, 14, 24);
  doc.setFontSize(9); doc.text(`Cliente: ${report.client?.['Nombre del Cliente'] || p['Cliente Relacionado'] || 'Sin cliente'}`, 14, 31);
  doc.text(`Estado: ${p['Estado del Proyecto'] || '—'} | Etapa: ${p['Etapa actual'] || '—'} | Riesgo: ${p['Riesgo'] || 'No definido'}`, 14, 38);
  doc.text(`Tareas: ${report.tasks.length} | Citas: ${report.meetings.length} | Actividades: ${report.activities.length} | Ingresos: ${reportMoney(income)} | Gastos: ${reportMoney(expenses)}`, 14, 45);
  let y = 53;
  const pdfTable = (title, headers, rows) => {
    if (!rows.length) return;
    doc.setFontSize(11); doc.text(title, 14, y); y += 3;
    doc.autoTable({ startY: y, head: [headers], body: rows.slice(0, 30), styles: { fontSize: 7 }, headStyles: { fillColor: [37, 99, 235] }, margin: { left: 14, right: 14 } });
    y = doc.lastAutoTable.finalY + 8;
    if (y > 175) { doc.addPage(); y = 18; }
  };
  pdfTable('Tareas', ['ID', 'Tarea', 'Estado', 'Responsable', 'Límite'], reportRows(report.tasks, ['ID Tarea', 'Tarea', 'Estado', 'Responsable', 'Fecha límite']));
  pdfTable('Pipeline y etapas', ['Proyecto', 'Etapa', 'Estado', 'Responsable', 'Comentarios'], reportRows(report.pipeline, ['ID Proyecto', 'Etapa', 'Estado', 'Responsable', 'Comentarios']));
  pdfTable('Citas', ['Fecha', 'Hora', 'Tipo', 'Responsable', 'Resultado'], reportRows(report.meetings, ['Fecha', 'Hora', 'Tipo', 'Responsable', 'Resultado']));
  pdfTable('Actividades', ['Fecha', 'Indicador', 'Cantidad', 'Responsable', 'Notas'], reportRows(report.activities, ['Fecha', 'Indicador', 'Cantidad', 'Responsable', 'Notas']));
  pdfTable('Archivos y entregables', ['Nombre', 'Tipo', 'Proyecto', 'Cliente', 'Fecha'], reportRows(report.files, ['Nombre del Archivo', 'Tipo', 'Proyecto', 'Cliente', 'Fecha Subida']));
  pdfTable('Cotizaciones', ['ID', 'Cliente', 'Fecha', 'Estado', 'Total'], reportRows(report.quotes, ['ID Cotización', 'Cliente', 'Fecha', 'Estado', 'Total']));
  pdfTable('Finanzas', ['ID', 'Tipo', 'Fecha', 'Descripción', 'Monto'], reportRows(report.finance, ['ID', 'Tipo', 'Fecha', 'Descripción', 'Monto']));
  doc.save(`reporte_${(p['ID Proyectos'] || 'proyecto').replace(/\s+/g, '_')}.pdf`);
}

// ── PIPELINE ─────────────────────────────────────────────────────
window.pipelineData = [];
window.pipelineConfigs = {};

const PIPELINE_BOARD_CONFIG = {
  proyectos: { boardId: 'kanban-pipeline', recordType: 'proyectos', dataKey: 'pipelineData', idField: 'ID Proyectos', stageField: 'Etapa actual' },
  prospectos: { boardId: 'kanban-pipeline-prospectos', recordType: 'prospectos', dataKey: 'prospectosData', idField: 'ID Prospectos', stageField: 'Etapa' },
  tareas: { boardId: 'kanban-tareas', recordType: 'tareas', dataKey: 'tareasData', idField: 'ID Tarea', stageField: 'Estado' }
};

function legacyPipelineFallback(key) {
  const definitions = {
    proyectos: { name: 'Pipeline de proyectos', values: [['1', 'Activación'], ['2', 'Diagnóstico'], ['3', 'Calendario de Contenido'], ['4', 'Creación de Contenido'], ['5', 'Campaña'], ['6', 'Reporte de Resultados'], ['7', 'Renovación']] },
    prospectos: { name: 'Pipeline de prospectos', values: [['Nuevo', 'Nuevo'], ['En Proceso', 'En Proceso'], ['Cerrado', 'Cerrado'], ['Perdido', 'Perdido'], ['Convertido', 'Convertido']] },
    tareas: { name: 'Pipeline de tareas', values: [['Pendiente', 'Pendiente'], ['En Proceso', 'En Proceso'], ['Terminado', 'Terminado']] }
  };
  const source = definitions[key] || definitions.proyectos;
  const stages = source.values.map(([legacy_value, name], index) => ({ stage_id: `STG-${key.toUpperCase()}-${index + 1}`, pipeline_id: `PIPE-${key.toUpperCase()}`, stage_key: legacy_value.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name, order_index: index, active: true, is_initial: index === 0, is_terminal: index === source.values.length - 1, legacy_value, conditions: [], actions: [], steps: [] }));
  return { pipeline_id: `PIPE-${key.toUpperCase()}`, key, name: source.name, entity_type: key, version: 1, status: 'published', active: true, stages, transitions: stages.flatMap(from => stages.filter(to => to.stage_id !== from.stage_id).map(to => ({ from_stage_id: from.stage_id, to_stage_id: to.stage_id, active: true }))) };
}

async function loadPipelineConfig(key, refresh = false) {
  if (!refresh && window.pipelineConfigs[key]) return window.pipelineConfigs[key];
  try {
    const response = await fetch(`${API}/api/pipelines/${encodeURIComponent(key)}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const pipeline = await response.json();
    window.pipelineConfigs[key] = pipeline;
    return pipeline;
  } catch (error) {
    console.warn(`[Pipeline] Usando configuración local para ${key}:`, error.message);
    const fallback = legacyPipelineFallback(key);
    window.pipelineConfigs[key] = fallback;
    return fallback;
  }
}

function pipelineStageForValue(pipeline, value) {
  const stages = (pipeline?.stages || []).filter(stage => stage.active !== false).sort((a, b) => a.order_index - b.order_index);
  return stages.find(stage => [stage.legacy_value, stage.stage_key, stage.name].map(String).includes(String(value))) || stages.find(stage => stage.is_initial) || stages[0] || null;
}

function pipelineProgress(pipeline, value) {
  const stages = (pipeline?.stages || []).filter(stage => stage.active !== false).sort((a, b) => a.order_index - b.order_index);
  const stage = pipelineStageForValue(pipeline, value);
  const index = stages.findIndex(item => item.stage_id === stage?.stage_id);
  if (index < 0) return 0;
  return stages.length <= 1 ? 100 : Math.round((index / (stages.length - 1)) * 100);
}

function renderPipelineColumns(board, pipeline) {
  if (!board) return;
  const stages = (pipeline?.stages || []).filter(stage => stage.active !== false).sort((a, b) => a.order_index - b.order_index);
  board.dataset.pipelineKey = pipeline?.key || '';
  board.innerHTML = stages.map(stage => `
    <div class="kanban-col" data-status="${escapeDetailHtml(stage.stage_id)}" data-stage-id="${escapeDetailHtml(stage.stage_id)}" style="--pipeline-stage-color:${escapeDetailHtml(stage.color || '#7c3aed')}">
      <h3 class="kanban-col-title"><span class="pipeline-stage-dot"></span>${escapeDetailHtml(stage.name)} <span class="kanban-count">0</span></h3>
      <div class="kanban-cards"></div>
    </div>`).join('');
  bindDynamicBoardDrag(board);
}

function bindDynamicBoardDrag(board) {
  if (!board || board.dataset.dragBound === 'true') return;
  board.dataset.dragBound = 'true';
  board.addEventListener('dragover', event => {
    const column = event.target.closest('.kanban-col');
    if (!column || !board.contains(column)) return;
    event.preventDefault();
    column.style.background = '#eef2ff';
  });
  board.addEventListener('dragleave', event => {
    const column = event.target.closest('.kanban-col');
    if (column) column.style.background = '';
  });
  board.addEventListener('drop', async event => {
    event.preventDefault();
    const column = event.target.closest('.kanban-col');
    if (!column) return;
    column.style.background = '';
    let dragData;
    try { dragData = JSON.parse(event.dataTransfer.getData('text/plain')); } catch (_) { return; }
    const pipelineKey = board.dataset.pipelineKey;
    if (!pipelineKey || !dragData?.id || !column.dataset.stageId) return;
    if (board.dataset.transitionPending === 'true') return;
    board.dataset.transitionPending = 'true';
    try {
      const result = await transitionPipelineRecord(pipelineKey, dragData.type, dragData.id, column.dataset.stageId, 'kanban_drag');
      synchronizeLocalPipelineRecord(dragData, result);
      showToast('Movimiento guardado');
       await loadTableroView(currentTablero);
    } catch (error) {
      showToast(error.message, true);
      await loadTableroView(currentTablero);
    } finally {
      delete board.dataset.transitionPending;
    }
  });
}

async function transitionPipelineRecord(pipelineKey, recordType, recordId, stageId, source = 'pipeline_frontend') {
  const response = await fetch(`${API}/api/pipelines/${encodeURIComponent(pipelineKey)}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Source': source },
    body: JSON.stringify({ record_type: recordType, record_id: recordId, to_stage_id: stageId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Transición no permitida; recarga el tablero e inténtalo de nuevo');
  if (result.persisted !== true) throw new Error('La transición no confirmó la persistencia; el tablero no se actualizará');
  return result;
}

function synchronizeLocalPipelineRecord(dragData, result) {
  const config = PIPELINE_BOARD_CONFIG[dragData?.type];
  const pipeline = window.pipelineConfigs[dragData?.type];
  const stageValue = result?.stage?.legacy_value || result?.stage?.stage_key;
  if (!config || !pipeline || !stageValue) return;
  const records = window[config.dataKey] || [];
  const record = records.find(item => item[config.idField] === dragData.id);
  if (record) {
    record[config.stageField] = stageValue;
    record.pipeline_state = result.state || null;
  }
}

function renderDynamicKanban(pipeline, records, config) {
  const board = document.getElementById(config.boardId);
  if (!board) return;
  renderPipelineColumns(board, pipeline);
  const data = filterByDate(records || []);
  data.forEach(record => {
    const id = record[config.idField] || '';
    const stage = pipelineStageForValue(pipeline, record[config.stageField]);
    const targetColumn = [...board.querySelectorAll('.kanban-col')].find(item => item.dataset.stageId === stage?.stage_id);
    const column = targetColumn?.querySelector('.kanban-cards');
    if (!column) return;
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.id = id;
    const safeId = encodeURIComponent(id);
    const type = config.recordType;
    card.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', JSON.stringify({ id, type, pipeline_id: pipeline.pipeline_id }));
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });

    const title = type === 'proyectos' ? record['Nombre del Proyecto'] : type === 'prospectos' ? record['Nombre del Contacto'] : record['Tarea'];
    const reference = type === 'proyectos' ? record['Cliente Relacionado'] : type === 'prospectos' ? record['Correo Electrónico'] : record['ID Proyecto'];
    const badge = type === 'tareas' ? priorityBadge(record['Prioridad']) : `<span class="badge badge-purple">${escapeDetailHtml(id || '—')}</span>`;
    card.innerHTML = `
      <div class="kanban-card-header" onclick="viewRecord('${type}', decodeURIComponent('${safeId}'))">
        <input type="checkbox" class="row-checkbox" value="${escapeDetailHtml(id)}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)">
        ${badge}<span class="kanban-card-date">${escapeDetailHtml(record['Fecha de Registro'] || record['Fecha límite'] || '')}</span>
      </div>
      <div class="kanban-card-title" onclick="viewRecord('${type}', decodeURIComponent('${safeId}'))">${escapeDetailHtml(title || '—')}</div>
      <div class="kanban-card-body" onclick="viewRecord('${type}', decodeURIComponent('${safeId}'))">
        <p><strong>${type === 'tareas' ? 'Proyecto' : type === 'prospectos' ? 'Contacto' : 'Cliente'}:</strong> ${escapeDetailHtml(reference || '—')}</p>
        ${type === 'proyectos' ? `<p><strong>Servicio:</strong> ${escapeDetailHtml(record['Servicio'] || '—')}</p>` : ''}
        ${type === 'prospectos' ? `<p><strong>Giro:</strong> ${escapeDetailHtml(record['Giro'] || '—')}</p>` : ''}
        ${type === 'tareas' ? `<p><strong>Límite:</strong> ${escapeDetailHtml(record['Fecha límite'] || '—')}</p>` : ''}
        <p title="${escapeDetailHtml(record['Notas'] || record['Comentarios'] || '')}">${escapeDetailHtml(truncate(record['Notas'] || record['Comentarios'], 40))}</p>
      </div>
      <div class="kanban-card-footer"><span class="kanban-card-resp">${escapeDetailHtml(type === 'proyectos' ? `Avance: ${pipelineProgress(pipeline, record[config.stageField])}%` : (record['Responsable'] || record['Asesor'] || ''))}</span><span class="badge badge-blue">${escapeDetailHtml(stage?.name || record[config.stageField] || '—')}</span></div>`;
    column.appendChild(card);
  });
  board.querySelectorAll('.kanban-col').forEach(column => {
    column.querySelector('.kanban-count').textContent = column.querySelectorAll('.kanban-card').length;
  });
}

async function loadPipeline() {
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json());
  if (!window.tareasData || window.tareasData.length === 0) {
    try { window.tareasData = await fetch(`${API}/api/tareas`).then(r => r.json()); } catch(e) {}
  }
  window.pipelineData = await fetch(`${API}/api/proyectos`).then(r => r.json());
  const pipeline = await loadPipelineConfig('proyectos');
  if (pipeline) renderDynamicKanban(pipeline, window.pipelineData, PIPELINE_BOARD_CONFIG.proyectos);
}

// ── TAREAS ───────────────────────────────────────────────────────
window.tareasData = [];
async function loadTareas() {
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json());
  window.tareasData = await fetch(`${API}/api/tareas`).then(r => r.json());
  const pipeline = await loadPipelineConfig('tareas');
  if (pipeline) renderDynamicKanban(pipeline, window.tareasData, PIPELINE_BOARD_CONFIG.tareas);
}

// ── CITAS ────────────────────────────────────────────────────────
async function loadCitas() {
  window.citasData = await fetch(`${API}/api/citas`).then(r => r.json()).catch(() => []);
  const data = filterByDate(window.citasData).filter(r => r['ID Citas']);
  const tbody = document.querySelector('#tableCitas tbody');
  tbody.innerHTML = data.length ? data.map(r => {
    const notas = r['Notas'] || '';
    return `<tr class="clickable-row" onclick="viewRecord('citas', '${r['ID Citas'] || ''}')">
      <td><input type="checkbox" class="row-checkbox" value="${r['ID Citas'] || ''}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-blue">${r['ID Citas'] || '—'}</span></td>
      <td><strong>${r['Nombre'] || '—'}</strong></td>
      <td>${r['Fecha de la Cita'] || '—'}</td>
      <td>${r['Hora de la Cita'] || '—'}</td>
      <td>${r['Correo'] || '—'}</td>
      <td>${r['Teléfono'] || '—'}</td>
      <td><span class="badge badge-purple">${r['Tipo de reunión'] || '—'}</span></td>
      <td>${r['Responsable'] || '—'}</td>
      <td>${notas.startsWith('📅') ? '<span style="color:var(--blue);font-size:12px;">Calendly</span>' : (notas ? (notas.length > 40 ? notas.slice(0, 40) + '…' : notas) : '—')}</td>
    </tr>`;
  }).join('') : emptyState();
}

// ── DASHBOARD ─────────────────────────────────────────────────────
let chartServiciosInstance = null;
let chartProspectosAsesor = null;
let chartCitasResponsable = null;
let chartPipelineEtapas = null;
let chartActividadesIndicador = null;
let chartActividadesResponsable = null;

async function loadDashboard() {
  try {
    window.clientesData = await fetch(`${API}/api/clientes`).then(r => r.json()).catch(() => []);
    window.proyectosData = await fetch(`${API}/api/proyectos`).then(r => r.json()).catch(() => []);
    window.pipelineData = await fetch(`${API}/api/pipeline_de_proyecto`).then(r => r.json()).catch(() => []);
    window.citasData = await fetch(`${API}/api/citas`).then(r => r.json()).catch(() => []);
    window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json()).catch(() => []);
    window.prospectosData = await fetch(`${API}/api/prospectos`).then(r => r.json()).catch(() => []);
    window.tareasData = await fetch(`${API}/api/tareas`).then(r => r.json()).catch(() => []);
    window.actividadesData = await fetch(`${API}/api/actividades`).then(r => r.json()).catch(() => []);
    
    const clientes = filterByDate(Array.isArray(window.clientesData) ? window.clientesData : []);
    const proyectos = filterByDate(Array.isArray(window.proyectosData) ? window.proyectosData : []);
    const pipeline = filterByDate(Array.isArray(window.pipelineData) ? window.pipelineData : []);
    const citas = filterByDate(Array.isArray(window.citasData) ? window.citasData : []);
    const prospectos = filterByDate(Array.isArray(window.prospectosData) ? window.prospectosData : []);
    const tareas = filterByDate(Array.isArray(window.tareasData) ? window.tareasData : []);
    const actividades = filterByDate(Array.isArray(window.actividadesData) ? window.actividadesData : []);

    // 1. COMERCIAL
    const kpiNuevosProspectos = prospectos.length;
    if (document.getElementById('kpiNuevosProspectos')) document.getElementById('kpiNuevosProspectos').textContent = kpiNuevosProspectos;
    if (document.getElementById('kpiCitas')) document.getElementById('kpiCitas').textContent = citas.length;

    const citasExitosas = citas.filter(c => c['Resultado'] === 'Exitosa').length;
    const showRate = citas.length > 0 ? Math.round((citasExitosas / citas.length) * 100) : 0;
    if (document.getElementById('kpiShowRate')) document.getElementById('kpiShowRate').textContent = showRate + '%';

    const prospectosAsesor = {};
    prospectos.forEach(p => {
      const a = p['Asesor'] || 'Sin Asignar';
      prospectosAsesor[a] = (prospectosAsesor[a] || 0) + 1;
    });
    renderBarChart('chartProspectosAsesor', prospectosAsesor, 'Prospectos', '#4f8ef7');

    const citasResponsable = {};
    citas.forEach(c => {
      const r = c['Responsable'] || 'Sin Asignar';
      citasResponsable[r] = (citasResponsable[r] || 0) + 1;
    });
    renderBarChart('chartCitasResponsable', citasResponsable, 'Citas', '#8b5cf6');

    // 2. FINANCIERO Y RETENCIÓN
    const mrr = clientes.reduce((sum, c) => {
      if (c['Estado'] === 'Activo') {
         return sum + (parseFloat(c['Valor mensual']) || parseFloat(c['Valor mensual ']) || 0);
      }
      return sum;
    }, 0);
    if (document.getElementById('kpiMRR')) document.getElementById('kpiMRR').textContent = '$' + mrr.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    let renovaciones = 0;
    let churn = 0;
    const today = new Date();
    clientes.forEach(c => {
      if (c['Estado'] === 'Activo' && c['Fecha próxima renovación']) {
        const renDateStr = c['Fecha próxima renovación'];
        let renDate = new Date(renDateStr);
        if (isNaN(renDate) && renDateStr.includes('/')) {
           const p = renDateStr.split('/');
           if (p.length === 3) renDate = new Date(`${p[2]}-${p[1]}-${p[0]}`);
        }
        if (!isNaN(renDate)) {
          const diffDays = (renDate - today) / (1000 * 60 * 60 * 24);
          if (diffDays >= 0 && diffDays <= 30) renovaciones++;
          if (diffDays < -7 || (c['Estatus'] || '').includes('Riesgo')) churn++;
        }
      }
    });
    if (document.getElementById('kpiRenovaciones')) document.getElementById('kpiRenovaciones').textContent = renovaciones;
    if (document.getElementById('kpiTotalClientes')) document.getElementById('kpiTotalClientes').textContent = (window.clientesData || []).length;

    // 3. OPERACIÓN Y EJECUCIÓN
    let sumAvance = 0;
    let validAvance = 0;
    let sumDiasMov = 0;
    let validDias = 0;
    let proyectosRiesgo = 0;

    proyectos.forEach(p => {
      if (p['Estado del Proyecto'] === 'Activo' || p['Estado del Proyecto'] === 'En Proceso') {
        const avanceStr = String(p['% Avance'] || '');
        if (avanceStr.includes('%')) {
           sumAvance += parseFloat(avanceStr.replace('%', ''));
           validAvance++;
        } else if (!isNaN(parseFloat(avanceStr))) {
           // sometimes it comes back as a decimal e.g., 0.1428
           const val = parseFloat(avanceStr);
           sumAvance += (val <= 1 ? val * 100 : val);
           validAvance++;
        }

        const diasStr = p['Días sin movimiento'];
        if (diasStr && !isNaN(parseInt(diasStr))) {
           sumDiasMov += parseInt(diasStr);
           validDias++;
        }
        if (p['Riesgo'] === 'Alto') proyectosRiesgo++;
      }
    });
    if (document.getElementById('kpiAvancePromedio')) document.getElementById('kpiAvancePromedio').textContent = validAvance > 0 ? Math.round(sumAvance / validAvance) + '%' : '0%';
    if (document.getElementById('kpiProyectosRiesgo')) document.getElementById('kpiProyectosRiesgo').textContent = proyectosRiesgo;
    if (document.getElementById('kpiDiasSinMovimiento')) document.getElementById('kpiDiasSinMovimiento').textContent = validDias > 0 ? Math.round(sumDiasMov / validDias) : '0';

    let sumTiempo = 0;
    let countTiempo = 0;
    const pipelineEtapas = {};
    pipeline.forEach(p => {
      const e = p['Etapa'] || 'Desconocida';
      pipelineEtapas[e] = (pipelineEtapas[e] || 0) + 1;
      
      const d = p['Duración'];
      if(d && !isNaN(parseInt(d))) {
          sumTiempo += parseInt(d);
          countTiempo++;
      } else if (p['Fecha Inicio'] && p['Fecha Fin']) {
        const d1 = new Date(p['Fecha Inicio']);
        const d2 = new Date(p['Fecha Fin']);
        if (!isNaN(d1) && !isNaN(d2)) {
          sumTiempo += (d2 - d1) / (1000 * 60 * 60 * 24);
          countTiempo++;
        }
      }
    });
    if (document.getElementById('kpiTiempoEtapa')) document.getElementById('kpiTiempoEtapa').textContent = countTiempo > 0 ? Math.round(sumTiempo / countTiempo) : '0';
    renderBarChart('chartPipelineEtapas', pipelineEtapas, 'Proyectos', '#06b6d4');

    const serviciosCount = {};
    proyectos.forEach(p => {
      const s = p['Servicio'] || p['Tipo de Servicio'];
      if (s) {
        serviciosCount[s] = (serviciosCount[s] || 0) + 1;
      }
    });
    renderDoughnutChart('chartServicios', serviciosCount);

    // 4. PRODUCTIVIDAD Y ACTIVIDADES
    let tareasCompletadas = 0;
    let tareasATiempo = 0;
    tareas.forEach(t => {
      if (t['Estado'] === 'Terminado') {
        tareasCompletadas++;
        if (t['Fecha límite'] && t['Fecha de Registro']) {
            const fLim = new Date(t['Fecha límite']);
            const fReg = new Date(t['Fecha de Registro']);
            if (!isNaN(fLim) && !isNaN(fReg) && fLim >= fReg) {
                tareasATiempo++;
            }
        }
      }
    });
    if (document.getElementById('kpiTareasCompletadas')) document.getElementById('kpiTareasCompletadas').textContent = tareasCompletadas;
    if (document.getElementById('kpiCumplimientoFechas')) document.getElementById('kpiCumplimientoFechas').textContent = tareasCompletadas > 0 ? Math.round((tareasATiempo / tareasCompletadas) * 100) + '%' : '0%';

    const actividadesIndicador = {};
    const actividadesResponsable = {};
    actividades.forEach(a => {
      const ind = a['Indicador'] || 'Otro';
      const res = a['Responsable'] || 'Sin Asignar';
      const cant = parseInt(a['Cantidad']) || 0;
      actividadesIndicador[ind] = (actividadesIndicador[ind] || 0) + cant;
      actividadesResponsable[res] = (actividadesResponsable[res] || 0) + cant;
    });
    renderBarChart('chartActividadesIndicador', actividadesIndicador, 'Volumen', '#10b981');
    renderBarChart('chartActividadesResponsable', actividadesResponsable, 'Volumen', '#f59e0b');

  } catch(e) {
    console.error(e);
  }
}


// ── MODAL ────────────────────────────────────────────────────────
window.aiCommunicationContext = null;
window.aiCommunicationHistory = [];

function aiModuleForCurrentView() {
  if (currentSection === 'tableros') {
    return ({ pipeline: 'proyectos', 'pipeline-prospectos': 'prospectos', tareas: 'tareas' }[currentTablero] || 'tareas');
  }
  return ['prospectos', 'clientes', 'proyectos', 'tareas', 'citas', 'actividades'].includes(currentSection) ? currentSection : null;
}

function openAiCommunicationModal() {
  const context = window.aiCommunicationContext || { module: aiModuleForCurrentView(), recordId: null };
  const moduleLabel = context.module ? context.module.replace(/_/g, ' ') : 'vista actual';
  const scopeLabel = context.recordId ? `registro seleccionado en ${moduleLabel}` : moduleLabel;
  const contextCard = document.getElementById('aiContextCard');
  const modal = document.getElementById('aiCommunicationModal');
  const promptInput = document.getElementById('aiPrompt');
  if (!modal || !promptInput) {
    showToast('La interfaz del asistente aún no terminó de cargar.', true);
    return;
  }
  if (contextCard) contextCard.textContent = `Contexto: ${scopeLabel}`;
  modal.classList.remove('hidden');
  promptInput.focus();
  fetch('/api/ai/status').then(response => response.json()).then(status => {
    const statusMessage = document.getElementById('aiStatusMessage');
    if (statusMessage) statusMessage.textContent = status.available
      ? (status.providerConfigured ? 'IA activa con fallback local de seguridad.' : 'Modo local activo; no se envían datos a un proveedor externo.')
      : 'Asistente desactivado por seguridad. Requiere autenticación de la aplicación.';
  }).catch(() => {});
}

function closeAiCommunicationModal() {
  document.getElementById('aiCommunicationModal').classList.add('hidden');
}

function setAiQuickPrompt(prompt) {
  const input = document.getElementById('aiPrompt');
  if (input) {
    input.value = prompt;
    input.focus();
  }
}

function aiListHtml(items) {
  const list = Array.isArray(items) ? items : [];
  return list.length ? `<ul>${list.map(item => `<li>${escapeDetailHtml(item)}</li>`).join('')}</ul>` : '<p class="ai-empty-result">Sin datos suficientes.</p>';
}

function renderAiCommunicationResult(payload) {
  const result = payload.result || {};
  const resultElement = document.getElementById('aiResult');
  resultElement.innerHTML = `
    ${payload.notice ? `<div class="ai-result-notice">${escapeDetailHtml(payload.notice)}</div>` : ''}
    <div class="ai-result-summary"><span class="ai-result-label">Resumen</span><p>${escapeDetailHtml(result.summary || '')}</p></div>
    <div class="ai-result-columns">
      <div><span class="ai-result-label">Puntos clave</span>${aiListHtml(result.key_points)}</div>
      <div><span class="ai-result-label">Riesgos</span>${aiListHtml(result.risks)}</div>
      <div><span class="ai-result-label">Próximos pasos</span>${aiListHtml(result.next_steps)}</div>
    </div>
    <div class="ai-draft"><div class="ai-draft-header"><span class="ai-result-label">Borrador</span><button type="button" class="btn btn-outline btn-small" onclick="copyAiDraft()"><i class="ph ph-copy"></i> Copiar</button></div>${result.subject ? `<strong>${escapeDetailHtml(result.subject)}</strong>` : ''}<p id="aiDraftText">${escapeDetailHtml(result.draft || '')}</p></div>`;
  resultElement.classList.remove('hidden');
}

async function submitAiCommunication() {
  const prompt = document.getElementById('aiPrompt').value.trim();
  const button = document.getElementById('aiSubmitButton');
  const resultElement = document.getElementById('aiResult');
  if (!prompt) {
    showToast('Escribe qué necesitas comunicar.', true);
    return;
  }

  const context = window.aiCommunicationContext || { module: aiModuleForCurrentView(), recordId: null };
  button.disabled = true;
  button.innerHTML = '<i class="ph ph-spinner"></i> Preparando...';
  resultElement.classList.add('hidden');
  try {
    const response = await fetch('/api/ai/communication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        channel: document.getElementById('aiChannel').value,
        tone: document.getElementById('aiTone').value,
        module: context.module,
        record_id: context.recordId,
        history: window.aiCommunicationHistory || []
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'No se pudo preparar la comunicación.');
    renderAiCommunicationResult(payload);
    window.aiCommunicationHistory = [
      ...(window.aiCommunicationHistory || []),
      { request: prompt, summary: payload.result?.summary || '' }
    ].slice(-6);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="ph ph-sparkle"></i> Preparar comunicación';
  }
}

async function copyAiDraft() {
  const draft = document.getElementById('aiDraftText')?.textContent || '';
  if (!draft) return;
  try {
    await navigator.clipboard.writeText(draft);
    showToast('Borrador copiado');
  } catch (_) {
    showToast('No se pudo copiar el borrador.', true);
  }
}

async function openModal(title, body) {
  if (!title && !body) {
    // If called without arguments, open the 'Nuevo Registro' form for current section
    title = 'Nuevo Registro';
    if (currentSection === 'clientes' && !window.prospectosData) {
      try {
        window.prospectosData = await fetch(`${API}/api/prospectos`).then(r => r.json());
      } catch (e) {
        window.prospectosData = [];
        showToast('No se pudieron cargar los prospectos', true);
      }
    }
    if (['proyectos', 'prospectos', 'tareas'].includes(currentSection) && !window.pipelineConfigs[currentSection]) {
      await loadPipelineConfig(currentSection);
    }
    switch(currentSection) {
      case 'clientes': body = formCliente(); break;
      case 'prospectos': body = formProspecto(); break;
      case 'proyectos': body = formProyecto(); break;
      case 'pipeline': body = formPipeline(); break;
      case 'tareas': body = formTarea(); break;
      case 'citas': body = formCita(); break;
      case 'actividades': body = formActividad(); break;
      case 'cotizaciones': body = formCotizacion(); break;
      case 'pagos_gastos':
      case 'pagos-y-gastos':
      case 'pagos y gastos':
        body = formPagosGastos();
        break;
      default: body = '<p class="text-muted">No hay formulario disponible para esta sección.</p>';
    }
  }
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modal').classList.toggle('modal-record-detail', String(body || '').includes('record-detail-view'));
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal(e) {
  // Si no hay evento (llamado por código) o el click fue directamente en el overlay o en el botón de cerrar
  if (!e || !e.target || e.target.id === 'modalOverlay' || e.target.closest('.modal-close')) {
    document.getElementById('modalOverlay').classList.add('hidden');
  }
}

// ── FORM TEMPLATES ────────────────────────────────────────────────
function formProspecto() {
  return `<form onsubmit="submitForm(event,'prospectos')">
    <div class="form-grid">
      <div class="form-group"><label>Nombre *</label><input name="nombre" required></div>
      <div class="form-group"><label>Correo</label><input name="correo" type="email"></div>
      <div class="form-group"><label>Teléfono</label><input name="telefono"></div>
      <div class="form-group"><label>Giro</label>
        <select name="giro">
          <option value="">Seleccionar giro...</option>
          ${giroOptions()}
        </select>
      </div>
      <div class="form-group"><label>Asesor</label>
        <select name="asesor">
          <option value="">Selecciona Asesor...</option>
          ${generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor')}
        </select>
      </div>
      <div class="form-group"><label>Etapa</label><select name="etapa">${pipelineStageOptions('prospectos')}</select></div>
      <div class="form-group"><label>Medio de Contacto</label>
        <select name="medioDeContacto">
          <option value="">Seleccionar...</option>
          <option value="Whatsapp">Whatsapp</option>
          <option value="Redes sociales">Redes sociales</option>
          <option value="Recomendación">Recomendación</option>
          <option value="Llamada">Llamada</option>
          <option value="Evento">Evento</option>
          <option value="Correo">Correo</option>
        </select>
      </div>
      <div class="form-group full"><label>Notas</label><input name="notas"></div>
      <div class="form-group full-width"><label>Situación</label><textarea name="situacion"></textarea></div>
      <div class="form-group full-width"><label>Problema</label><textarea name="problema"></textarea></div>
      <div class="form-group full-width"><label>Implicación</label><textarea name="implicacion"></textarea></div>
      <div class="form-group full-width"><label>Necesidad</label><textarea name="necesidad"></textarea></div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Guardar Prospecto</button>
  </form>`;
}

function formCliente() {
  return `<form onsubmit="submitForm(event,'clientes')">
    <div class="form-grid">
      <div class="form-group full"><label>Convertir prospecto</label>
        <select name="prospectoId" onchange="prefillClienteFromProspecto(this.value)">
          <option value="">Cliente nuevo sin prospecto</option>
          ${(window.prospectosData || []).filter(r => (r['Etapa'] || r['Etapa del Prospecto'] || '') !== 'Convertido').map(r => `<option value="${r['ID Prospectos'] || ''}">${r['Nombre del Contacto'] || 'Sin nombre'}${r['Correo Electrónico'] ? ` - ${r['Correo Electrónico']}` : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Nombre *</label><input name="nombre" required></div>
      <div class="form-group"><label>Empresa *</label><input name="empresa" required></div>
      <div class="form-group"><label>Correo</label><input name="correo" type="email"></div>
      <div class="form-group"><label>Teléfono</label><input name="telefono"></div>
      <div class="form-group"><label>Estado</label>
        <select name="estado"><option>Activo</option><option>Pausado</option><option>Baja</option></select></div>
      <div class="form-group"><label>Servicio</label>
        <select name="servicios">
          <option>Servicios de diagnóstico</option>
          <option>Diseño de sistemas</option>
          <option>Automatización</option>
          <option>Diseño web</option>
          <option>Campaña ADS</option>
          <option>Paquete contenido</option>
          <option>Branding</option>
          <option>Socio de crecimiento</option>
          <option>Video</option>
          <option>Diseño gráfico</option>
        </select></div>
      <div class="form-group"><label>Valor Mensual $</label><input name="valorMensual" type="number"></div>
      <div class="form-group"><label>Prioridad</label>
        <select name="prioridad"><option>Alta</option><option>Media</option><option>Baja</option></select></div>
      <div class="form-group"><label>Fecha Renovación</label><input name="renovacion" type="date"></div>
      <div class="form-group"><label>Dirección</label><input name="direccion"></div>
      <div class="form-group"><label>Giro</label><input name="giro"></div>
      <div class="form-group full"><label>Notas sobre el Cliente</label><input name="notas"></div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Guardar Cliente</button>
  </form>`;
}

function prefillClienteFromProspecto(prospectoId) {
  const prospecto = (window.prospectosData || []).find(r => r['ID Prospectos'] === prospectoId);
  if (!prospecto) return;
  const form = document.querySelector('#modalBody form');
  if (!form) return;
  const values = {
    nombre: prospecto['Nombre del Contacto'] || '',
    correo: prospecto['Correo Electrónico'] || '',
    telefono: prospecto['Teléfono'] || '',
    notas: prospecto['Notas'] || ''
  };
  Object.entries(values).forEach(([name, value]) => {
    const input = form.elements[name];
    if (input) input.value = value;
  });
}

function generateOptions(dataStore, idKey, nameKey) {
  if (!window[dataStore] || !window[dataStore].length) return '<option value="">Cargando / Sin datos...</option>';
  return window[dataStore].map(r => `<option value="${r[idKey]}">${r[nameKey]}</option>`).join('');
}

function pipelineStageOptions(key, selectedValue = '') {
  const pipeline = window.pipelineConfigs[key];
  if (pipeline?.stages?.length) {
    return pipeline.stages.filter(stage => stage.active !== false).sort((a, b) => a.order_index - b.order_index)
      .map(stage => { const value = stage.legacy_value || stage.stage_key; return `<option value="${escapeDetailHtml(value)}" ${String(value) === String(selectedValue) ? 'selected' : ''}>${escapeDetailHtml(stage.name)}</option>`; }).join('');
  }
  const fallback = {
    proyectos: [['1', '1 -> Activación'], ['2', '2 -> Diagnóstico'], ['3', '3 -> Calendario de Contenido'], ['4', '4 -> Creación de Contenido'], ['5', '5 -> Campaña'], ['6', '6 -> Reporte de Resultados'], ['7', '7 -> Renovación']],
    prospectos: [['Nuevo', 'Nuevo'], ['En Proceso', 'En Proceso'], ['Cerrado', 'Cerrado'], ['Perdido', 'Perdido']],
    tareas: [['Pendiente', 'Pendiente'], ['En Proceso', 'En Proceso'], ['Terminado', 'Terminado']]
  };
  return (fallback[key] || []).map(([value, label]) => `<option value="${escapeDetailHtml(value)}" ${String(value) === String(selectedValue) ? 'selected' : ''}>${escapeDetailHtml(label)}</option>`).join('');
}

function formProyecto() {
  return `<form onsubmit="submitForm(event,'proyectos')">
    <div class="form-grid">
      <div class="form-group full"><label>Nombre del Proyecto *</label><input name="nombre" required></div>
      <div class="form-group"><label>Cliente Relacionado *</label>
        <select name="idCliente" required>
          <option value="">Selecciona Cliente...</option>
          ${generateOptions('clientesData', 'ID Clientes', 'Nombre del Cliente')}
        </select>
      </div>
      <div class="form-group"><label>Servicio</label>
        <select name="servicio">
          <option>Servicios de diagnóstico</option>
          <option>Diseño de sistemas</option>
          <option>Automatización</option>
          <option>Diseño web</option>
          <option>Campaña ADS</option>
          <option>Paquete contenido</option>
          <option>Branding</option>
          <option>Socio de crecimiento</option>
          <option>Video</option>
          <option>Diseño gráfico</option>
        </select></div>
      <div class="form-group"><label><i class="ph-bold ph-arrows-clockwise" style="vertical-align:middle; margin-right:4px;"></i> Etapa Actual del Flujo</label>
        <select name="etapa">
          ${pipelineStageOptions('proyectos')}
        </select></div>
      <div class="form-group"><label>Estado del Proyecto</label>
        <select name="estado">
          <option>Activo</option>
          <option>Reunión</option>
          <option>Cerrado</option>
        </select></div>

      <div class="form-group"><label>Prioridad</label>
        <select name="prioridad"><option>Alta</option><option>Media</option><option>Baja</option></select></div>
      <div class="form-group"><label>Riesgo</label>
        <select name="riesgo"><option>Bajo</option><option>Medio</option><option>Alto</option></select></div>
      <div class="form-group full"><label>Notas</label><input name="notas"></div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Guardar Proyecto</button>
  </form>`;
}

function formPipeline() {
  return `<form onsubmit="submitForm(event,'pipeline_de_proyecto')">
    <div class="form-grid">
      <div class="form-group"><label>Proyecto *</label>
        <select name="idProyecto" required>
          <option value="">Selecciona Proyecto...</option>
          ${generateOptions('proyectosData', 'ID Proyectos', 'Nombre del Proyecto')}
        </select>
      </div>
      <div class="form-group"><label>Cliente</label>
        <select name="idCliente">
          <option value="">Selecciona Cliente...</option>
          ${generateOptions('clientesData', 'ID Clientes', 'Nombre del Cliente')}
        </select>
      </div>
      <div class="form-group"><label>Etapa *</label>
        <select name="etapa" required>
          <option>Activación</option><option>Diagnóstico</option><option>Calendario de Contenido</option>
          <option>Creación de Contenido</option><option>Campaña</option><option>Reporte de Resultados</option>
        </select></div>
      <div class="form-group"><label>Responsable</label>
        <select name="responsable">
          <option value="">Selecciona Asesor...</option>
          ${generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor')}
        </select>
      </div>
      <div class="form-group"><label>Fecha Inicio</label><input name="fechaInicio" type="date"></div>
      <div class="form-group"><label>Fecha Fin</label><input name="fechaFin" type="date"></div>
      <div class="form-group"><label>Estado</label>
        <select name="estado"><option>En Proceso</option><option>Completado</option><option>Bloqueado</option></select></div>
      <div class="form-group full"><label>Comentarios</label><input name="comentarios"></div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Guardar Etapa</button>
  </form>`;
}

function formTarea() {
  return `<form onsubmit="submitForm(event,'tareas')">
    <div class="form-grid">
      <div class="form-group"><label>Proyecto *</label>
        <select name="idProyecto" required>
          <option value="">Selecciona Proyecto...</option>
          ${generateOptions('proyectosData', 'ID Proyectos', 'Nombre del Proyecto')}
        </select>
      </div>
      <div class="form-group"><label>Cliente *</label>
        <select name="idCliente" required>
          <option value="">Selecciona Cliente...</option>
          ${generateOptions('clientesData', 'ID Clientes', 'Nombre del Cliente')}
        </select>
      </div>
      <div class="form-group"><label>Categoría</label>
        <select name="categoria">
          <option>Diseño</option><option>Campañas</option><option>Web</option>
          <option>Branding</option><option>Administración</option>
          <option>Business Manager</option><option>Meta</option><option>Google</option><option>Extras</option>
        </select></div>
      <div class="form-group"><label>Responsable</label>
        <select name="responsable">
          <option value="">Selecciona Asesor...</option>
          ${generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor')}
        </select>
      </div>
      <div class="form-group full"><label>Tarea *</label><input name="tarea" required></div>
      <div class="form-group"><label>Prioridad</label>
        <select name="prioridad"><option>Alta</option><option>Media</option><option>Baja</option></select></div>
      <div class="form-group"><label>Fecha Inicio</label><input name="fechaInicio" type="date"></div>
      <div class="form-group"><label>Fecha Límite</label><input name="fechaLimite" type="date"></div>
      <div class="form-group"><label>Estado</label>
        <select name="estado">${pipelineStageOptions('tareas')}</select></div>
      <div class="form-group full"><label>Comentarios</label><input name="comentarios"></div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Guardar Tarea</button>
  </form>`;
}



function formCita() {
  return `<form onsubmit="submitForm(event,'citas')">
    <div class="form-grid">
      <div class="form-group full"><label>Nombre / Tema *</label><input name="nombre" required></div>
      <div class="form-group"><label>Proyecto</label>
        <select name="idProyecto">
          <option value="">Selecciona Proyecto...</option>
          ${generateOptions('proyectosData', 'ID Proyectos', 'Nombre del Proyecto')}
        </select>
      </div>
      <div class="form-group"><label>Cliente</label>
        <select name="idCliente">
          <option value="">Selecciona Cliente...</option>
          ${generateOptions('clientesData', 'ID Clientes', 'Nombre del Cliente')}
        </select>
      </div>
      <div class="form-group"><label>Tipo</label>
        <select name="tipo">
          <option>Kickoff</option><option>Diagnóstico</option><option>Seguimiento</option>
          <option>Presentación</option><option>Reporte</option><option>Renovación</option>
        </select></div>
      <div class="form-group"><label>Correo</label><input name="correo" type="email"></div>
      <div class="form-group"><label>Teléfono</label><input name="telefono"></div>
      <div class="form-group"><label>Fecha *</label><input name="fecha" type="date" required></div>
      <div class="form-group"><label>Hora</label><input name="hora" type="time"></div>
      <div class="form-group"><label>Responsable</label>
        <select name="responsable">
          <option value="">Selecciona Asesor...</option>
          ${generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor')}
        </select>
      </div>
      <div class="form-group full"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Guardar Cita</button>
  </form>`;
}

// ── FORM SUBMIT ───────────────────────────────────────────────────
async function submitForm(event, endpoint, id = null) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const body = Object.fromEntries(new FormData(form));
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API}/api/${endpoint}/${id}` : `${API}/api/${endpoint}`;
  
  try {
    const r = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await r.json();
    if (result.success) {
      let conversionWarning = '';
      if (endpoint === 'clientes' && !id && body.prospectoId) {
        try {
          const conversion = await fetch(`${API}/api/prospectos/${encodeURIComponent(body.prospectoId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ etapa: 'Convertido' })
          });
          if (!conversion.ok) conversionWarning = ' El prospecto no pudo marcarse como Convertido.';
        } catch (e) {
          conversionWarning = ' El prospecto no pudo marcarse como Convertido.';
        }
      }
      closeModal();
      showToast(`<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i> Registro guardado en Google Sheets.${conversionWarning}`);
      if (endpoint === 'tareas') window.tareasData = null;
      loadSection(currentSection);
      if (endpoint === 'clientes' && body.prospectoId) loadProspectos();
      if (endpoint === 'pagos_gastos' && !id) {
        setTimeout(() => descargarVoucher(body), 500);
      }
    } else {
      showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; vertical-align:middle; margin-right:4px;"></i> Error: ' + result.error, true);
    }
  } catch (e) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; vertical-align:middle; margin-right:4px;"></i> Error de conexión', true);
  } finally {
    btn.textContent = 'Guardar';
    btn.disabled = false;
  }
}

// ── TABLE FILTER ──────────────────────────────────────────────────
function filterTable(tableId, query) {
  const q = query.toLowerCase();
  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function filterKanban(boardId, query) {
  const q = query.toLowerCase();
  const cards = document.querySelectorAll(`#${boardId} .kanban-card`);
  cards.forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── HELPERS ───────────────────────────────────────────────────────
function truncate(str, n) { return str && str.length > n ? str.substring(0, n) + '...' : (str || ''); }

function statusBadge(s) {
  if (!s) return '<span class="badge badge-gray">—</span>';
  const map = { 'Activo': 'green', 'Inactivo': 'red', 'Reunión': 'orange', 'Cerrado': 'gray', 'Detenido': 'orange' };
  return `<span class="badge badge-${map[s] || 'gray'}">${s}</span>`;
}
function priorityBadge(p) {
  const map = { 'Alta': 'red', 'Media': 'orange', 'Baja': 'green' };
  return `<span class="badge badge-${map[p] || 'gray'}">${p || '—'}</span>`;
}
function riskBadge(r) {
  const map = { 'Alto': 'red', 'Medio': 'orange', 'Bajo': 'green' };
  return `<span class="badge badge-${map[r] || 'gray'}">${r || '—'}</span>`;
}
function taskStatusBadge(s) {
  const map = { 'Terminado': 'green', 'En Proceso': 'blue', 'Pendiente': 'orange', 'Vencida': 'red' };
  return `<span class="badge badge-${map[s] || 'gray'}">${s || '—'}</span>`;
}
function pipelineStatusBadge(s) {
  const map = { 'Completado': 'green', 'En Proceso': 'blue', 'Bloqueado': 'red' };
  return `<span class="badge badge-${map[s] || 'gray'}">${s || '—'}</span>`;
}
function emptyState() {
  return `<tr><td colspan="20"><div class="empty-state"><p>No hay registros aún. Usa "+ Nuevo Registro" para comenzar.</p></div></td></tr>`;
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.borderColor = isError ? 'var(--accent-red)' : 'var(--accent-green)';
  toast.style.color = isError ? 'var(--accent-red)' : 'var(--accent-green)';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ── INIT ──────────────────────────────────────────────────────────
loadDashboard();

// ── KANBAN DRAG & DROP LOGIC ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const cols = document.querySelectorAll('.kanban-col');
  cols.forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.style.background = '#eef2ff'; });
    col.addEventListener('dragleave', e => { col.style.background = '#f4f5f7'; });
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.style.background = '#f4f5f7';
      const newStatus = col.getAttribute('data-status');
      if (!newStatus) return;
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const { id, type } = data;
        let record = null;
        let endpoint = '';
        if (type === 'proyectos') {
          record = window.pipelineData.find(r => r['ID Proyectos'] === id);
          endpoint = 'proyectos';
        } else if (type === 'tareas') {
          record = window.tareasData.find(r => r['ID Tarea'] === id);
          endpoint = 'tareas';
        } else if (type === 'prospectos') {
          record = window.prospectosData.find(r => r['ID Prospectos'] === id);
          endpoint = 'prospectos';
        }
        
        // For proyectos, the column data-status represents 'Etapa actual'
        const isProyectos = type === 'proyectos';
        const currentStatus = isProyectos ? record['Etapa actual'] : (type === 'prospectos' ? record['Etapa'] : record['Estado']);
        if (!record || currentStatus === newStatus) return;
        
        const payload = {};
        if (isProyectos) {
          payload.etapa = newStatus;
          record['Etapa actual'] = newStatus;
          loadPipeline();
        } else if (type === 'prospectos') {
          payload.etapa = newStatus;
          record['Etapa'] = newStatus;
          loadPipelineProspectos();
        } else {
          payload.estado = newStatus;
          record['Estado'] = newStatus;
          loadTareas();
        }
        showToast(`Moviendo a ${newStatus}...`);
        const res = await fetch(`${API}/api/${endpoint}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || 'Error al guardar el estado'); }
        showToast('Guardado correctamente');
        if (isProyectos) await loadPipeline(); else await loadTareas();
      } catch (err) { showToast(err.message, true); }
    });
  });
});

// ── RECORD VIEW AND EDIT LOGIC ────────────────────────────────────
const DETAIL_FIELD_DEFINITIONS = [
  { label: 'Nombre de la tarea', keys: ['Tarea'] },
  { label: 'Nombre del proyecto', keys: ['Nombre del Proyecto'] },
  { label: 'Nombre del prospecto', keys: ['Nombre del Contacto'] },
  { label: 'Nombre del cliente', keys: ['Nombre del Cliente'] },
  { label: 'Empresa', keys: ['Empresa o Razón Social', 'Empresa'] },
  { label: 'Correo', keys: ['Correo Electrónico', 'Correo'] },
  { label: 'Teléfono', keys: ['Teléfono', 'Teléfono Principal'] },
  { label: 'Giro', keys: ['Giro'] },
  { label: 'Asesor', keys: ['Asesor', 'Responsable'] },
  { label: 'Medio de contacto', keys: ['Medio de contacto'] },
  { label: 'Estado', keys: ['Estado', 'Estatus'] },
  { label: 'Etapa', keys: ['Etapa', 'Etapa actual'] },
  { label: 'Prioridad', keys: ['Prioridad'] },
  { label: 'Servicio ofrecido', keys: ['Servicio', 'Servicios contratados', 'Tipo de Servicio'] },
  { label: 'Valor mensual', keys: ['Valor mensual'] },
  { label: 'Descripción', keys: ['Descripción', 'Concepto', 'Nombre/Tema'] },
  { label: 'Notas', keys: ['Notas', 'Notas sobre el Cliente', 'Comentarios', 'Evidencia'] },
  { label: 'Fecha de registro', keys: ['Fecha de Registro', 'Fecha'] }
];

function escapeDetailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function getDetailFields(record) {
  return DETAIL_FIELD_DEFINITIONS.map(definition => {
    const key = definition.keys.find(candidate => Object.prototype.hasOwnProperty.call(record, candidate));
    const value = key ? String(record[key] ?? '').trim() : '';
    return key && value ? { ...definition, key, value } : null;
  }).filter(Boolean);
}

function viewRecord(endpoint, id) {
  if (isDeleteMode) {
    const cb = document.querySelector(`.row-checkbox[value="${id}"]`);
    if (cb) {
      cb.checked = !cb.checked;
      toggleSelection(id, cb.checked);
    }
    return;
  }
  let record = null;
  const storeName = endpoint === 'pipeline_de_proyecto' ? 'pipeline' : endpoint;
  const dataStore = window[`${storeName}Data`] || [];
  
  // Find record dynamically since ID keys vary (e.g. "ID Clientes", "ID Tarea", etc.)
  record = dataStore.find(r => {
     return Object.values(r).includes(id);
  });
  
  if (!record) {
    showToast('Registro no encontrado en memoria', true);
    return;
  }

  window.aiCommunicationContext = { module: endpoint, recordId: id };

  const fields = getDetailFields(record);
  const titleField = fields[0];
  const nameForTitle = titleField?.value || id;
  const fieldHtml = fields.map((field, index) => {
    const value = String(field.value || '').trim();
    const encoded = [endpoint, id, field.key, value].map(encodeURIComponent);
    const isWide = ['Descripción', 'Notas'].includes(field.label);
    const isNotes = field.label === 'Notas';
    return `<article class="detail-field ${isWide ? 'detail-field-wide' : ''} ${isNotes ? 'detail-field-notes' : ''} ${index === 0 ? 'detail-field-primary' : ''}">
      <div class="detail-field-label">${field.label}</div>
      <div class="detail-field-value ${value ? '' : 'detail-field-empty'}" onclick="makeEditable(this, ...decodeURIComponent('${encoded.join('|')}').split('|'))">
        ${escapeDetailHtml(value || 'Sin información')}
        <i class="ph ph-pencil-simple detail-field-edit"></i>
      </div>
    </article>`;
  }).join('');
  const safeEndpoint = encodeURIComponent(endpoint);
  const safeId = encodeURIComponent(id);
  const html = `<div class="record-detail-view">
    <div class="record-detail-hero">
      <div class="record-detail-icon"><i class="ph ph-sparkle"></i></div>
      <div><span class="record-detail-kicker">Ficha resumida</span><h2>${escapeDetailHtml(nameForTitle)}</h2></div>
    </div>
    <div class="record-details-grid">${fieldHtml || '<p class="detail-field-empty">No hay información relevante para mostrar.</p>'}</div>
    <div class="record-detail-actions">
      <button class="btn btn-outline detail-delete-button" onclick="if(confirm('¿Estás seguro de eliminar este registro?')) { deleteRecord(decodeURIComponent('${safeEndpoint}'), decodeURIComponent('${safeId}')); closeModal(); }">
        <i class="ph ph-trash"></i> Eliminar registro
      </button>
    </div>
  </div>`;

  openModal(`Detalles: ${nameForTitle}`, html);
}

function makeEditable(el, endpoint, id, sheetKey, originalVal) {
  endpoint = decodeURIComponent(endpoint);
  id = decodeURIComponent(id);
  sheetKey = decodeURIComponent(sheetKey);
  originalVal = decodeURIComponent(originalVal);
  if (el.querySelector('input') || el.querySelector('select')) return; // Already editing
  
  if (originalVal === '—') originalVal = '';
  
  let input;
  if (sheetKey === 'Estado' || sheetKey === 'Prioridad' || sheetKey === 'Estatus' || sheetKey === 'Riesgo') {
    input = document.createElement('select');
    let opts = [];
    if (sheetKey === 'Estado') {
      if (endpoint === 'tareas') opts = ['Pendiente', 'En Proceso', 'Terminado'];
      else if (endpoint === 'pipeline_de_proyecto') opts = ['En Proceso', 'Completado', 'Bloqueado'];
      else if (endpoint === 'proyectos') opts = ['Activo', 'Reunión', 'Cerrado'];
      else opts = ['Activo', 'Pausado', 'Baja'];
    }
    if (sheetKey === 'Prioridad') opts = ['Alta', 'Media', 'Baja'];
    if (sheetKey === 'Estatus') opts = ['Al día', 'Atrasado', 'Suspendido'];
    if (sheetKey === 'Riesgo') opts = ['Alto', 'Medio', 'Bajo'];
    
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      if (o === originalVal) opt.selected = true;
      input.appendChild(opt);
    });
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.value = originalVal;
  }
  
  input.style.width = '100%';
  input.style.padding = '4px 8px';
  input.style.border = '1px solid var(--accent-blue)';
  input.style.borderRadius = '4px';
  input.style.outline = 'none';
  
  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
  
  const save = async () => {
    const newVal = input.value.trim();
    if (newVal === originalVal || (originalVal === '' && newVal === '')) {
      el.innerHTML = (originalVal || '—') + ' <i class="ph ph-pencil-simple" style="font-size: 0.8em; opacity: 0.5; margin-left: 5px;"></i>';
      return;
    }
    
    el.innerHTML = '<span style="color:var(--text-light)">Guardando...</span>';
    
    let mapKey = '';
    for (const [formKey, sheetHeaders] of Object.entries(MAPPING)) {
      if (sheetHeaders.includes(sheetKey)) {
        mapKey = formKey;
        // Fix conflict between asesor and responsable based on endpoint
        if (formKey === 'asesor' && endpoint === 'tareas') mapKey = 'responsable';
        break;
      }
    }
    if (!mapKey) {
      if (sheetKey.toLowerCase().startsWith('id ')) mapKey = 'id';
      else mapKey = sheetKey.toLowerCase().replace(/ /g, '');
    }
    
    try {
      const res = await fetch(`${API}/api/${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [mapKey]: newVal })
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || 'Error al actualizar'); }
      showToast('Actualizado correctamente');
      refreshData();
      
      // Update memory immediately to keep modal open with new data
      const storeName = endpoint === 'pipeline_de_proyecto' ? 'pipeline' : endpoint;
      const dataStore = window[`${storeName}Data`] || [];
      const record = dataStore.find(r => Object.values(r).includes(id));
      if (record) record[sheetKey] = newVal;
      
      el.innerHTML = (newVal || '—') + ' <i class="ph ph-pencil-simple" style="font-size: 0.8em; opacity: 0.5; margin-left: 5px;"></i>';
    } catch(err) {
      showToast(err.message, true);
      el.innerHTML = (originalVal || '—') + ' <i class="ph ph-pencil-simple" style="font-size: 0.8em; opacity: 0.5; margin-left: 5px;"></i>';
    }
  };
  
  if (input.tagName === 'SELECT') {
    input.onchange = save;
  }
  input.onblur = save;
  input.onkeydown = e => { if (e.key === 'Enter') save(); };
}

function editRecord(endpoint, id) {
  let html = '';
  // Load the corresponding form based on endpoint
  switch(endpoint) {
    case 'clientes': html = formCliente(); break;
    case 'prospectos': html = formProspecto(); break;
    case 'proyectos': html = formProyecto(); break;
    case 'pipeline_de_proyecto': html = formPipeline(); break;
    case 'tareas': html = formTarea(); break;
    case 'citas': html = formCita(); break;
    case 'actividades': html = formActividad(); break;
    case 'cotizaciones': html = formCotizacion(); break;
    case 'pagos_gastos': html = formPagosGastos(); break;
    default: showToast('Formulario no disponible', true); return;
  }
  
  openModal(`Editar: ${id}`, html);
  
  setTimeout(() => {
    const form = document.querySelector('#modalBody form');
    if (!form) return;
    
    // Change onsubmit to pass the ID for PUT
    form.setAttribute('onsubmit', `submitForm(event, '${endpoint}', '${id}')`);
    form.querySelector('button[type="submit"]').textContent = 'Actualizar Registro';
    
    // Pre-fill values
    const storeName = endpoint === 'pipeline_de_proyecto' ? 'pipeline' : endpoint;
    const dataStore = window[`${storeName}Data`] || [];
    const record = dataStore.find(r => Object.values(r).includes(id));
    if (!record) return;
    
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const name = input.name.toLowerCase();
      const possibleKeys = MAPPING[name] || [name];
      
      const key = Object.keys(record).find(k => 
        possibleKeys.some(pk => pk.toLowerCase() === k.toLowerCase()) || 
        k.toLowerCase().replace(/ /g, '') === name || 
        k.toLowerCase().replace(/_/g, '') === name
      );
      
      if (key && record[key]) {
        if (input.type === 'date' && record[key].includes('/')) {
            const parts = record[key].split('/');
            if (parts.length === 3) {
                input.value = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            } else {
                input.value = record[key];
            }
        } else {
            input.value = record[key];
        }
      }
    });
  }, 50);
}

async function deleteRecord(endpoint, id) {
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el registro ${id}?`)) return;
  
  try {
    const res = await fetch(`${API}/api/${endpoint}/${id}`, { method: 'DELETE' });
    const result = await res.json();
    
    if (result.success) {
      showToast('Registro eliminado exitosamente', 'success');
      closeModal();
      
      // Reload the corresponding view
      if (endpoint === 'clientes') loadClientes();
      else if (endpoint === 'prospectos') loadProspectos();
      else if (endpoint === 'proyectos') loadProyectos();
      else if (endpoint === 'pipeline_de_proyecto') loadPipeline();
      else if (endpoint === 'tareas') loadTareas();
      else if (endpoint === 'citas') loadCitas();
      else if (endpoint === 'actividades') loadActividades();
      else if (endpoint === 'cotizaciones') loadCotizaciones();
      else if (endpoint === 'archivos') loadArchivos();
    } else {
      throw new Error(result.error || 'Error al eliminar');
    }
  } catch (err) {
    showToast(err.message, true);
    console.error(err);
  }
}

// ── ACTIVIDADES (STATISTICS & SUBMIT) ──────────────────────────
async function loadActividades() {
  setTodayDate();
  // Ensure we have asesoresData for dropdown
  if (!Array.isArray(window.asesoresData) || !window.asesoresData.length) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json()).catch(() => []);
  if (!Array.isArray(window.prospectosData) || !window.prospectosData.length) window.prospectosData = await fetch(`${API}/api/prospectos`).then(r => r.json()).catch(() => []);
  if (!Array.isArray(window.clientesData) || !window.clientesData.length) window.clientesData = await fetch(`${API}/api/clientes`).then(r => r.json()).catch(() => []);
  const selectResp = document.getElementById('act-responsable');
  if (selectResp && selectResp.options.length <= 1) {
    selectResp.innerHTML = '<option value="">Selecciona Asesor...</option>' + generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor');
  }
  const relationSelect = document.getElementById('act-relacion');
  if (relationSelect) {
    renderActividadRelaciones();
  }

  window.actividadesData = await fetch(`${API}/api/actividades`).then(r => r.json()).catch(() => []);
  const data = filterByDate(window.actividadesData);
  
  const statsDiv = document.getElementById('actividadesStats');
  if (!statsDiv) return;
  renderActividadesTable(data);

  // 1. Group by Asesor AND calculate global max per Indicador
  const byAsesor = {};
  const maxByIndicador = {};

  data.forEach(r => {
    const asesor = r['Responsable'] || 'Sin Asignar';
    const indicador = r['Indicador'] || 'Otro';
    const cant = parseInt(r['Cantidad']) || 1;
    
    if (!byAsesor[asesor]) byAsesor[asesor] = {};
    if (!byAsesor[asesor][indicador]) byAsesor[asesor][indicador] = 0;
    byAsesor[asesor][indicador] += cant;
  });

  // Calculate max values for each indicador to make bars comparable
  for (const asesor in byAsesor) {
    for (const ind in byAsesor[asesor]) {
      if (!maxByIndicador[ind] || byAsesor[asesor][ind] > maxByIndicador[ind]) {
        maxByIndicador[ind] = byAsesor[asesor][ind];
      }
    }
  }

  if (Object.keys(byAsesor).length === 0) {
    statsDiv.innerHTML = emptyState();
    return;
  }

  let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">';
  for (const asesor in byAsesor) {
    html += `<div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
      <h4 style="margin-bottom:15px; font-weight:600; color:var(--text); border-bottom: 1px solid #eee; padding-bottom:10px;">${asesor}</h4>
      <div style="display:flex; flex-direction:column; gap:15px;">`;
      
    const actividades = byAsesor[asesor];
    
    for (const ind in actividades) {
      const val = actividades[ind];
      const maxVal = maxByIndicador[ind];
      const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
      
      // Use different colors based on activity to make them distinct
      const colors = ['#4f8ef7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      const colorIndex = Object.keys(maxByIndicador).indexOf(ind) % colors.length;
      const barColor = colors[colorIndex];
      
      html += `
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
            <span style="color:var(--text); font-weight:500;">${ind}</span>
            <span style="color:var(--text-muted); font-weight:600;">${val}</span>
          </div>
          <div style="height:8px; background:rgba(0,0,0,0.05); border-radius:10px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:10px; transition: width 0.5s ease;"></div>
          </div>
        </div>
      `;
    }
    html += `</div></div>`;
  }
  html += '</div>';
  statsDiv.innerHTML = html;
}

function renderActividadRelaciones(query = '') {
  const relationSelect = document.getElementById('act-relacion');
  if (!relationSelect) return;
  const currentValue = relationSelect.value;
  const normalizedQuery = String(query).trim().toLowerCase();
  const matches = (name, id, email = '') => !normalizedQuery || [name, id, email].join(' ').toLowerCase().includes(normalizedQuery);
  const prospectOptions = (window.prospectosData || [])
    .filter(p => matches(p['Nombre del Contacto'], p['ID Prospectos'], p['Correo Electrónico']))
    .map(p => `<option value="Prospecto: ${escapeDetailHtml(p['ID Prospectos'] || '')} - ${escapeDetailHtml(p['Nombre del Contacto'] || '')}">Prospecto: ${escapeDetailHtml(p['Nombre del Contacto'] || p['ID Prospectos'] || '')}</option>`).join('');
  const clientOptions = (window.clientesData || [])
    .filter(c => matches(c['Nombre del Cliente'], c['ID Clientes'], c['Correo Electrónico']))
    .map(c => `<option value="Cliente: ${escapeDetailHtml(c['ID Clientes'] || '')} - ${escapeDetailHtml(c['Nombre del Cliente'] || '')}">Cliente: ${escapeDetailHtml(c['Nombre del Cliente'] || c['ID Clientes'] || '')}</option>`).join('');
  relationSelect.innerHTML = `<option value="">Sin relación</option><optgroup label="Prospectos">${prospectOptions || '<option disabled>No hay prospectos encontrados</option>'}</optgroup><optgroup label="Clientes">${clientOptions || '<option disabled>No hay clientes encontrados</option>'}</optgroup>`;
  if (currentValue && [...relationSelect.options].some(option => option.value === currentValue)) relationSelect.value = currentValue;
}

function renderActividadesTable(data) {
  const tbody = document.querySelector('#tableActividades tbody');
  if (!tbody) return;
  tbody.innerHTML = data.length ? data.map(r => {
    const id = r['ID Actividades'] || r['ID Actividad'] || r['ID'] || '';
    return `<tr class="clickable-row">
      <td><input type="checkbox" class="row-checkbox" value="${id}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-orange">${id || '—'}</span></td>
      <td>${r['Fecha'] || '—'}</td>
      <td>${r['Indicador'] || '—'}</td>
      <td>${r['Cantidad'] || '—'}</td>
      <td>${r['Responsable'] || '—'}</td>
      <td title="${r['Notas'] || ''}">${truncate(r['Notas'], 40)}</td>
    </tr>`;
  }).join('') : emptyState();
}

async function submitActividad(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';

  const payload = {
    fecha: document.getElementById('act-fecha').value,
    indicador: document.getElementById('act-tipo').value,
    cantidad: document.getElementById('act-cantidad').value,
    responsable: document.getElementById('act-responsable').value,
    notas: document.getElementById('act-relacion').value
  };

  try {
    const res = await fetch(`${API}/api/actividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || 'Error al guardar la actividad'); }
    
    showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i> Actividad registrada correctamente');
    form.reset();
    setTodayDate();
    loadActividades();
  } catch (error) {
    console.error(error);
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; vertical-align:middle; margin-right:4px;"></i> Ocurrió un error al guardar');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar indicador';
  }
}

// ── COTIZACIONES ──────────────────────────────────────────────────
window.cotizacionesData = [];
async function loadCotizaciones() {
  if (!window.prospectosData) window.prospectosData = await fetch(`${API}/api/prospectos`).then(r => r.json()).catch(() => []);
  window.cotizacionesData = await fetch(`${API}/api/cotizaciones`).then(r => r.json()).catch(() => []);
  const data = filterByDate(window.cotizacionesData);
  const tbody = document.querySelector('#tableCotizaciones tbody');
  tbody.innerHTML = data.length ? data.map(r => `
    <tr class="clickable-row" onclick="viewRecord('cotizaciones', '${r['ID Cotización'] || ''}')">
      <td><input type="checkbox" class="row-checkbox" value="${r['ID Cotización'] || ''}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-blue">${r['ID Cotización'] || '—'}</span></td>
      <td><strong>${r['Cliente'] || '—'}</strong></td>
      <td>${r['Fecha'] || '—'}</td>
      <td>${r['Vencimiento'] || '—'}</td>
      <td>${r['Email'] || '—'}</td>
      <td>${r['Subtotal'] ? '$' + parseFloat(r['Subtotal']).toLocaleString() : '—'}</td>
      <td><strong>${r['Total'] ? '$' + parseFloat(r['Total']).toLocaleString() : '—'}</strong></td>
      <td><a href="#" onclick="event.stopPropagation(); downloadCotizacionPDF('${r['ID Cotización'] || ''}')"><i class="ph ph-file-pdf" style="color:#ef4444; font-size:18px;"></i></a></td>
    </tr>`).join('') : emptyState();
}

function downloadCotizacionPDF(id) {
  window.open(`${API}/api/cotizaciones/${id}/pdf`, '_blank');
}

let servicioCount = 0;
function formCotizacion() {
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
  servicioCount = 0;
  return `<form onsubmit="submitCotizacion(event)">
    <div class="form-grid">
      <div class="form-group full"><label>Prospecto *</label>
        <select name="cliente" required>
          <option value="">Selecciona Prospecto...</option>
          ${generateOptions('prospectosData', 'Nombre del Contacto', 'Nombre del Contacto')}
        </select>
      </div>
      <div class="form-group"><label>Email</label><input name="email" type="email"></div>
      <div class="form-group"><label>Teléfono</label><input name="telefono"></div>
      <div class="form-group"><label>Fecha</label><input name="fecha" type="date" value="${today}"></div>
      <div class="form-group"><label>Vence</label><input name="vencimiento" type="date" value="${nextMonth}"></div>
    </div>
    <div style="margin:16px 0;border-top:1px solid var(--border);padding-top:16px;">
      <div class="form-group" style="margin-bottom:12px;">
        <label>IVA</label>
        <select name="ivaRate" onchange="calcPreview()" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px;">
          <option value="16">16%</option>
          <option value="8">8%</option>
          <option value="0">Sin IVA</option>
        </select>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <label style="font-weight:600;font-size:14px;">Servicios</label>
        <button type="button" class="btn btn-outline" style="padding:4px 12px;font-size:12px;" onclick="addServicioRow()">+ Agregar Servicio</button>
      </div>
      <table id="serviciosTable" style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:var(--surface);">
          <th style="padding:8px;text-align:left;width:50%;">Descripción</th>
          <th style="padding:8px;text-align:center;width:15%;">Cant.</th>
          <th style="padding:8px;text-align:right;width:17%;">P. Unit.</th>
          <th style="padding:8px;text-align:right;width:18%;">Total</th>
        </tr></thead>
        <tbody id="serviciosBody"></tbody>
      </table>
      <div style="text-align:right;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <span style="font-size:14px;color:var(--text2);">Subtotal: $<span id="previewSubtotal">0.00</span></span><br>
        <span style="font-size:14px;color:var(--text2);">IVA (16%): $<span id="previewIVA">0.00</span></span><br>
        <span style="font-size:18px;font-weight:700;color:var(--primary);">Total: $<span id="previewTotal">0.00</span></span>
      </div>
    </div>
    <div class="form-group full"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
    <button type="submit" class="btn btn-primary btn-block">Generar Cotización</button>
  </form>`;
}

function addServicioRow() {
  const tbody = document.getElementById('serviciosBody');
  const i = servicioCount++;
  const tr = document.createElement('tr');
  tr.id = `servicio-row-${i}`;
  tr.innerHTML = `
    <td style="padding:4px;"><input name="servicio_desc_${i}" placeholder="Ej: Diseño web" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px;"></td>
    <td style="padding:4px;"><input name="servicio_cant_${i}" type="number" min="1" value="1" oninput="calcPreview()" style="width:60px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px;text-align:center;"></td>
    <td style="padding:4px;"><input name="servicio_precio_${i}" type="number" step="0.01" min="0" oninput="calcPreview()" style="width:90px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px;text-align:right;"></td>
    <td style="padding:4px;text-align:right;font-weight:600;" id="servicio_total_${i}">$0.00</td>
  `;
  tbody.appendChild(tr);
  calcPreview();
}

function calcPreview() {
  let subtotal = 0;
  for (let i = 0; i < servicioCount; i++) {
    const row = document.getElementById(`servicio-row-${i}`);
    if (!row || row.style.display === 'none') continue;
    const cant = parseFloat(row.querySelector(`[name="servicio_cant_${i}"]`).value) || 0;
    const precio = parseFloat(row.querySelector(`[name="servicio_precio_${i}"]`).value) || 0;
    const total = cant * precio;
    subtotal += total;
    document.getElementById(`servicio_total_${i}`).textContent = `$${total.toFixed(2)}`;
  }
  const ivaRate = parseFloat(document.querySelector('[name="ivaRate"]')?.value) || 0;
  const iva = subtotal * (ivaRate / 100);
  const granTotal = subtotal + iva;
  document.getElementById('previewSubtotal').textContent = subtotal.toFixed(2);
  document.getElementById('previewIVA').textContent = iva.toFixed(2);
  document.getElementById('previewIVA').parentNode.firstChild.textContent = `IVA (${ivaRate}%): `;
  document.getElementById('previewTotal').textContent = granTotal.toFixed(2);
}

async function submitCotizacion(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.textContent = 'Generando...';
  btn.disabled = true;

  const servicios = [];
  for (let i = 0; i < servicioCount; i++) {
    const row = document.getElementById(`servicio-row-${i}`);
    if (!row) continue;
    const desc = (row.querySelector(`[name="servicio_desc_${i}"]`).value || '').trim();
    const cant = parseInt(row.querySelector(`[name="servicio_cant_${i}"]`).value) || 0;
    const precio = parseFloat(row.querySelector(`[name="servicio_precio_${i}"]`).value) || 0;
    if (desc && cant > 0) {
      servicios.push({ descripcion: desc, cantidad: cant, precio });
    }
  }

  if (servicios.length === 0) {
    showToast('Agrega al menos un servicio', true);
    btn.textContent = 'Generar Cotización';
    btn.disabled = false;
    return;
  }

  const body = {
    cliente: form.cliente.value,
    email: form.email.value,
    telefono: form.telefono.value,
    fecha: form.fecha.value,
    vencimiento: form.vencimiento.value,
    notas: form.notas.value,
    servicios: servicios,
    ivaRate: form.ivaRate.value,
  };

  try {
    const r = await fetch(`${API}/api/cotizaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await r.json();
    if (result.success) {
      showToast('Cotización generada. Descargando PDF...');
      closeModal();
      loadCotizaciones();
      // Auto-download PDF
      setTimeout(() => downloadCotizacionPDF(result.id), 500);
    } else {
      showToast('Error: ' + (result.error || 'Error al guardar'), true);
    }
  } catch (e) {
    showToast('Error de conexión', true);
  } finally {
    btn.textContent = 'Generar Cotización';
    btn.disabled = false;
  }
}

// ── ARCHIVOS ──────────────────────────────────────────────────────
window.archivosData = [];
async function loadArchivos() {
  // Check Drive status
  try {
    const ds = await fetch(`${API}/api/archivos/drive-status`).then(r => r.json());
    const banner = document.getElementById('driveBanner');
    if (!ds.connected && banner) {
      banner.innerHTML = '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;font-size:13px;">⚠️ Google Drive no está conectado. <a href="' + ds.authUrl + '" target="_blank" style="color:#3b82f6;font-weight:600;">Autorizar Drive</a> para poder subir archivos.</div>';
    } else if (banner) {
      banner.innerHTML = '';
    }
  } catch(e) {}

  window.archivosData = await fetch(`${API}/api/archivos`).then(r => r.json()).catch(() => []);
  const data = filterByDate(window.archivosData);
  const tbody = document.querySelector('#tableArchivos tbody');
  tbody.innerHTML = data.length ? data.map(r => `
    <tr class="clickable-row" onclick="viewRecord('archivos', '${r['ID Archivo'] || ''}')">
      <td><input type="checkbox" class="row-checkbox" value="${r['ID Archivo'] || ''}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-orange">${r['ID Archivo'] || '—'}</span></td>
      <td><strong>${r['Nombre del Archivo'] || r['Nombre'] || '—'}</strong></td>
      <td><span class="badge badge-blue">${r['Tipo'] || '—'}</span></td>
      <td>${r['Tamaño'] || '—'}</td>
      <td>${r['Fecha Subida'] || r['Fecha'] || '—'}</td>
      <td>${r['Proyecto'] || '—'}</td>
      <td>${r['Cliente'] || '—'}</td>
      <td>${r.webViewLink ? '<a href="' + r.webViewLink + '" target="_blank" onclick="event.stopPropagation()"><i class="ph ph-download-simple" style="color:#3b82f6; font-size:18px;"></i></a>' : '—'}</td>
    </tr>`).join('') : emptyState();
}

async function uploadArchivo(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('proyecto', prompt('Proyecto relacionado (opcional):') || '');
  formData.append('cliente', prompt('Cliente relacionado (opcional):') || '');
  formData.append('notas', prompt('Notas (opcional):') || '');

  try {
    const res = await fetch(`${API}/api/archivos/upload`, { method: 'POST', body: formData });
    const result = await res.json();
    if (result.success) {
      showToast('Archivo subido correctamente');
      loadArchivos();
    } else {
      showToast('Error: ' + (result.error || 'Error al subir'), true);
    }
  } catch (e) {
    showToast('Error de conexión al subir archivo', true);
  }
  event.target.value = '';
}

// ── PIPELINE PROSPECTOS ──────────────────────────────────────────
async function loadPipelineProspectos() {
  const asesoresRequest = Array.isArray(window.asesoresData)
    ? Promise.resolve(window.asesoresData)
    : fetch(`${API}/api/asesores`).then(r => r.json()).catch(() => []);
  const [asesores, prospectos] = await Promise.all([
    asesoresRequest,
    fetch(`${API}/api/prospectos`).then(r => r.json()).catch(() => [])
  ]);
  window.asesoresData = asesores;
  window.prospectosData = prospectos;
  const pipeline = await loadPipelineConfig('prospectos');
  if (pipeline) renderDynamicKanban(pipeline, window.prospectosData, PIPELINE_BOARD_CONFIG.prospectos);
}

// Patch btnAdd for archivos/citas to trigger custom actions
(function() {
  const origOnClick = document.getElementById('btnAdd').onclick;
  document.getElementById('btnAdd').onclick = function(e) {
    if (currentSection === 'archivos') {
      document.getElementById('fileUploadInput').click();
    } else if (currentSection === 'citas') {
      openCalendlyModal();
    } else {
      origOnClick.call(this, e);
    }
  };
})();

// ── CALENDLY ───────────────────────────────────────────────────────
function openCalendlyModal() {
  const container = document.getElementById('calendlyContainer');
  container.innerHTML = '<div class="calendly-inline-widget" data-url="https://calendly.com/demiansoberanes7/30min?primary_color=f4dd58" style="min-width:320px;height:700px;"></div>';
  document.getElementById('calendlyModal').classList.remove('hidden');

  // Re-init Calendly widget
  if (window.Calendly) {
    Calendly.initInlineWidget({
      url: 'https://calendly.com/demiansoberanes7/30min?primary_color=f4dd58',
      parentElement: container,
    });
  }
}

function closeCalendlyModal() {
  document.getElementById('calendlyModal').classList.add('hidden');
  document.getElementById('calendlyContainer').innerHTML = '';
  loadCitas();
}

// Listen for Calendly booking events
window.addEventListener('message', function(e) {
  if (e.origin !== 'https://calendly.com') return;
  if (e.data.event === 'calendly.event_scheduled') {
    const payload = e.data.payload || {};
    console.log('[Calendly] Payload:', payload);

    const eventUri = payload.event_uri || (payload.event && payload.event.uri) || '';
    
    if (eventUri) {
      // Use backend to fetch real data via Calendly API
      fetch(`${API}/api/citas/from-calendly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventUri }),
      })
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          showToast(`✅ Cita agendada con ${result.nombre || 'invitado'}`);
          closeCalendlyModal();
        } else {
          showToast('Error al guardar cita: ' + (result.error || ''), true);
        }
      })
      .catch(err => {
        console.error('[Calendly] Error:', err);
        showToast('Error de conexión al guardar cita', true);
      });
    } else {
      // Fallback: parse from postMessage directly
      const eventData = payload.event || payload.scheduled_event || {};
      const invitee = payload.invitee || {};
      const name = invitee.name || eventData.name || 'Cita Calendly';
      const email = invitee.email || '';
      const startTime = eventData.start_time || '';
      let dateStr = '';
      let timeStr = '';
      if (startTime) {
        const dt = new Date(startTime);
        if (!isNaN(dt)) {
          dateStr = dt.toISOString().split('T')[0];
          const hh = String(dt.getHours()).padStart(2, '0');
          const mm = String(dt.getMinutes()).padStart(2, '0');
          timeStr = `${hh}:${mm}`;
        }
      }
      fetch(`${API}/api/citas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: name, correo: email,
          fecha: dateStr, hora: timeStr,
          notas: '📅 Agendado vía Calendly',
          tipo: 'Cita Calendly', responsable: '',
        }),
      })
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          showToast(`✅ Cita agendada con ${name}`);
          closeCalendlyModal();
        }
      })
      .catch(err => console.error('[Calendly] Error:', err));
    }
  }
});

// ── TABLEROS UNIFICADOS ───────────────────────────────────────────
let currentTablero = 'pipeline';

function loadTableros() {
  const sel = document.getElementById('tableroSelector');
  currentTablero = sel ? sel.value : 'pipeline';
  loadAvailablePipelines().finally(() => loadTableroView(currentTablero));
}

async function loadAvailablePipelines() {
  const selector = document.getElementById('tableroSelector');
  if (!selector) return;
  try {
    const response = await fetch(`${API}/api/pipelines?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const definitions = await response.json();
    const builtIn = new Set(['proyectos', 'prospectos', 'tareas']);
    selector.querySelectorAll('option[data-custom-pipeline="true"]').forEach(option => option.remove());
    definitions.filter(definition => !builtIn.has(definition.key)).forEach(definition => {
      const option = document.createElement('option');
      option.value = `custom:${definition.key}`;
      option.dataset.customPipeline = 'true';
      option.textContent = `${definition.name} · ${definition.entity_type}`;
      selector.appendChild(option);
    });
    if ([...selector.options].some(option => option.value === currentTablero)) selector.value = currentTablero;
  } catch (_) {
    // The built-in boards remain usable with the local fallback.
  }
}

function openTareaModal() {
  openModal('Nueva Tarea', formTarea());

  const catalogs = [
    ['proyectos', 'proyectosData'],
    ['clientes', 'clientesData'],
    ['asesores', 'asesoresData']
  ];
  Promise.all(catalogs.map(async ([endpoint, key]) => {
    if (Array.isArray(window[key]) && window[key].length) return true;
    try {
      const response = await fetch(`${API}/api/${endpoint}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      window[key] = Array.isArray(data) ? data : [];
      return Array.isArray(data);
    } catch (e) {
      window[key] = Array.isArray(window[key]) ? window[key] : [];
      return false;
    }
  })).then(results => {
    const overlay = document.getElementById('modalOverlay');
    if (overlay?.classList.contains('hidden')) return;
    document.getElementById('modalBody').innerHTML = formTarea();
    if (results.some(result => !result)) showToast('Algún catálogo no pudo cargar', true);
  });
}

async function loadTableroView(name) {
  document.querySelectorAll('.tablero-panel').forEach(p => p.classList.add('hidden'));
  if (name.startsWith('custom:')) {
    const panel = document.getElementById('tablero-pipeline');
    if (panel) panel.classList.remove('hidden');
    const pipelineKey = name.slice('custom:'.length);
    const pipeline = await loadPipelineConfig(pipelineKey, true);
    const entityType = pipeline?.entity_type || 'proyectos';
    const config = PIPELINE_BOARD_CONFIG[entityType];
    if (pipeline && config) {
      const records = await fetch(`${API}/api/${entityType}?t=${Date.now()}`, { cache: 'no-store' }).then(response => response.json()).catch(() => []);
      renderDynamicKanban(pipeline, records, { ...config, boardId: 'kanban-pipeline' });
    }
    return;
  }
  const panel = document.getElementById('tablero-' + name);
  if (panel) panel.classList.remove('hidden');

  const loaders = {
    'pipeline': loadPipeline,
    'pipeline-prospectos': loadPipelineProspectos,
    'tareas': loadTareas,
  };
  if (loaders[name]) await loaders[name]();
}

function switchTablero(value) {
  currentTablero = value;
  document.getElementById('tableroSearch').value = '';
  loadTableroView(value);
}

function filterTablero(query) {
  const boardIds = {
    'pipeline': 'kanban-pipeline',
    'pipeline-prospectos': 'kanban-pipeline-prospectos',
    'tareas': 'kanban-tareas',
  };
  const boardId = currentTablero.startsWith('custom:') ? 'kanban-pipeline' : boardIds[currentTablero];
  if (boardId) filterKanban(boardId, query);
}

window.pipelineEditorState = { definitions: {}, selectedKey: 'proyectos', invalidJson: false };

function pipelineEditorJson(value, fallback = []) {
  if (!value) return JSON.stringify(fallback, null, 2);
  return JSON.stringify(value, null, 2);
}

function pipelineEditorId(value) {
  try { return decodeURIComponent(value); } catch (_) { return value; }
}

function pipelineEditorStage(stageId) {
  const normalizedId = pipelineEditorId(stageId);
  return window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey]?.stages.find(stage => stage.stage_id === normalizedId);
}

function updatePipelineEditorMeta(field, value) {
  const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
  if (definition) definition[field] = value;
}

function updatePipelineStage(stageId, field, value) {
  const stage = pipelineEditorStage(stageId);
  if (!stage) return;
  stage[field] = value;
  if (field === 'is_initial' && value) {
    const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
    const normalizedId = pipelineEditorId(stageId);
    definition.stages.forEach(item => { if (item.stage_id !== normalizedId) item.is_initial = false; });
  }
}

function updatePipelineStageJson(stageId, field, value) {
  const stage = pipelineEditorStage(stageId);
  if (!stage) return;
  try { stage[field] = JSON.parse(value); window.pipelineEditorState.invalidJson = false; } catch (_) { window.pipelineEditorState.invalidJson = true; showToast('El JSON de la etapa no es válido', true); }
}

function updatePipelineStep(stageId, stepId, field, value) {
  const stage = pipelineEditorStage(stageId);
  const step = stage?.steps?.find(item => item.step_id === pipelineEditorId(stepId));
  if (step) step[field] = value;
}

function updatePipelineStepJson(stageId, stepId, field, value) {
  const stage = pipelineEditorStage(stageId);
  const step = stage?.steps?.find(item => item.step_id === pipelineEditorId(stepId));
  if (!step) return;
  try { step[field] = JSON.parse(value); window.pipelineEditorState.invalidJson = false; } catch (_) { window.pipelineEditorState.invalidJson = true; showToast('El JSON del paso no es válido', true); }
}

function movePipelineStage(stageId, direction) {
  const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
  if (!definition) return;
  const stages = [...definition.stages].sort((a, b) => a.order_index - b.order_index);
  const index = stages.findIndex(stage => stage.stage_id === pipelineEditorId(stageId));
  const target = index + direction;
  if (index < 0 || target < 0 || target >= stages.length) return;
  [stages[index], stages[target]] = [stages[target], stages[index]];
  stages.forEach((stage, order) => { stage.order_index = order; });
  definition.stages = stages;
  renderPipelineEditor();
}

function movePipelineStep(stageId, stepId, direction) {
  const stage = pipelineEditorStage(stageId);
  if (!stage) return;
  const steps = [...(stage.steps || [])].sort((a, b) => a.order_index - b.order_index);
  const index = steps.findIndex(step => step.step_id === pipelineEditorId(stepId));
  const target = index + direction;
  if (index < 0 || target < 0 || target >= steps.length) return;
  [steps[index], steps[target]] = [steps[target], steps[index]];
  steps.forEach((step, order) => { step.order_index = order; });
  stage.steps = steps;
  renderPipelineEditor();
}

function addPipelineStage() {
  const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
  if (!definition) return;
  const name = prompt('Nombre de la nueva etapa:');
  if (!name?.trim()) return;
  const key = prompt('Clave única de la etapa:', name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  if (!key?.trim()) return;
  const hasInitial = definition.stages.some(stage => stage.is_initial && stage.active !== false);
  definition.stages.push({
    stage_id: `STG-${Date.now()}`,
    pipeline_id: definition.pipeline_id,
    stage_key: key.trim(),
    name: name.trim(),
    type: 'stage',
    order_index: definition.stages.length,
    active: true,
    is_initial: !hasInitial,
    is_terminal: false,
    color: '#7c3aed',
    legacy_value: key.trim(),
    conditions: [],
    actions: [],
    steps: []
  });
  renderPipelineEditor();
}

function removePipelineStage(stageId) {
  const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
  const stage = pipelineEditorStage(stageId);
  if (!definition || !stage || !confirm(`¿Eliminar la etapa "${stage.name}"? Los registros se reencadenarán al siguiente paso.`)) return;
  const normalizedId = pipelineEditorId(stageId);
  if (definition.stages.length <= 1) { showToast('El pipeline debe conservar al menos una etapa', true); return; }
  definition.stages = definition.stages.filter(item => item.stage_id !== normalizedId);
  if (!definition.stages.some(item => item.is_initial)) definition.stages[0].is_initial = true;
  definition.stages.forEach((item, index) => { item.order_index = index; });
  definition.transitions = (definition.transitions || []).filter(item => item.from_stage_id !== normalizedId && item.to_stage_id !== normalizedId);
  renderPipelineEditor();
}

function addPipelineStep(stageId) {
  const stage = pipelineEditorStage(stageId);
  if (!stage) return;
  const name = prompt(`Nombre del paso para ${stage.name}:`);
  if (!name?.trim()) return;
  stage.steps = stage.steps || [];
  stage.steps.push({ step_id: `STEP-${Date.now()}`, stage_id: stageId, step_key: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: name.trim(), type: 'task', order_index: stage.steps.length, active: true, conditions: [], actions: [], config: {} });
  renderPipelineEditor();
}

function removePipelineStep(stageId, stepId) {
  const stage = pipelineEditorStage(stageId);
  if (!stage) return;
  stage.steps = (stage.steps || []).filter(step => step.step_id !== pipelineEditorId(stepId));
  stage.steps.forEach((step, index) => { step.order_index = index; });
  renderPipelineEditor();
}

function renderPipelineEditor() {
  const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
  const container = document.getElementById('pipelineEditorBody');
  if (!definition || !container) return;
  const stages = [...definition.stages].sort((a, b) => a.order_index - b.order_index);
  container.innerHTML = `
    <div class="pipeline-editor-toolbar">
      <div class="form-group"><label>Nombre del pipeline</label><input value="${escapeDetailHtml(definition.name)}" disabled></div>
      <div class="form-group"><label>Estado</label><input value="${definition.status === 'published' ? 'Publicado' : definition.status}" disabled></div>
      <div class="form-group"><label>Versión</label><input value="${escapeDetailHtml(definition.version)}" disabled></div>
    </div>
    <div class="pipeline-editor-actions"><button class="btn btn-outline" onclick="addPipelineStage()"><i class="ph ph-plus"></i> Nueva etapa</button><span class="text-muted">${stages.length} etapas configuradas</span></div>
    <div class="pipeline-stage-editor-list">${stages.map((stage, index) => `
      <article class="pipeline-stage-editor">
        <header><strong>${index + 1}. ${escapeDetailHtml(stage.name)}</strong><div><button class="btn btn-outline btn-small" onclick="movePipelineStage('${encodeURIComponent(stage.stage_id)}', -1)">↑</button><button class="btn btn-outline btn-small" onclick="movePipelineStage('${encodeURIComponent(stage.stage_id)}', 1)">↓</button><button class="btn btn-outline btn-small" onclick="removePipelineStage('${encodeURIComponent(stage.stage_id)}')"><i class="ph ph-trash"></i></button></div></header>
        <div class="pipeline-editor-grid">
          <div class="form-group"><label>Nombre</label><input value="${escapeDetailHtml(stage.name)}" oninput="updatePipelineStage(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'name',this.value)"></div>
          <div class="form-group"><label>Clave</label><input value="${escapeDetailHtml(stage.stage_key)}" oninput="updatePipelineStage(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'stage_key',this.value)"></div>
          <div class="form-group"><label>Tipo</label><input value="${escapeDetailHtml(stage.type)}" oninput="updatePipelineStage(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'type',this.value)"></div>
          <div class="form-group"><label>Valor legacy</label><input value="${escapeDetailHtml(stage.legacy_value)}" oninput="updatePipelineStage(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'legacy_value',this.value)"></div>
          <label class="pipeline-check"><input type="checkbox" ${stage.active !== false ? 'checked' : ''} onchange="updatePipelineStage(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'active',this.checked)"> Activa</label>
          <label class="pipeline-check"><input type="checkbox" ${stage.is_initial ? 'checked' : ''} onchange="updatePipelineStage(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'is_initial',this.checked)"> Inicial</label>
          <label class="pipeline-check"><input type="checkbox" ${stage.is_terminal ? 'checked' : ''} onchange="updatePipelineStage(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'is_terminal',this.checked)"> Terminal</label>
        </div>
        <div class="pipeline-editor-json"><label>Condiciones JSON</label><textarea onblur="updatePipelineStageJson(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'conditions',this.value)">${escapeDetailHtml(pipelineEditorJson(stage.conditions))}</textarea><label>Acciones JSON</label><textarea onblur="updatePipelineStageJson(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),'actions',this.value)">${escapeDetailHtml(pipelineEditorJson(stage.actions))}</textarea></div>
        <div class="pipeline-step-header"><strong>Pasos</strong><button class="btn btn-outline btn-small" onclick="addPipelineStep(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'))">+ Paso</button></div>
        ${(stage.steps || []).sort((a, b) => a.order_index - b.order_index).map((step, stepIndex) => `
          <div class="pipeline-step-editor"><div class="pipeline-step-title"><span>${stepIndex + 1}.</span><input value="${escapeDetailHtml(step.name)}" oninput="updatePipelineStep(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'),'name',this.value)"><button class="btn btn-outline btn-small" onclick="movePipelineStep(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'),-1)">↑</button><button class="btn btn-outline btn-small" onclick="movePipelineStep(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'),1)">↓</button><button class="btn btn-outline btn-small" onclick="removePipelineStep(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'))"><i class="ph ph-trash"></i></button></div><div class="pipeline-editor-grid"><input value="${escapeDetailHtml(step.step_key)}" placeholder="Clave" oninput="updatePipelineStep(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'),'step_key',this.value)"><select onchange="updatePipelineStep(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'),'type',this.value)">${['task', 'approval', 'notification', 'automation', 'custom'].map(type => `<option ${step.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select><label class="pipeline-check"><input type="checkbox" ${step.active !== false ? 'checked' : ''} onchange="updatePipelineStep(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'),'active',this.checked)"> Activo</label></div><div class="pipeline-editor-json"><textarea onblur="updatePipelineStepJson(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'),'conditions',this.value)" placeholder="Condiciones JSON">${escapeDetailHtml(pipelineEditorJson(step.conditions))}</textarea><textarea onblur="updatePipelineStepJson(decodeURIComponent('${encodeURIComponent(stage.stage_id)}'),decodeURIComponent('${encodeURIComponent(step.step_id)}'),'actions',this.value)" placeholder="Acciones JSON">${escapeDetailHtml(pipelineEditorJson(step.actions))}</textarea></div></div>`).join('')}
      </article>`).join('')}</div>
     <div class="pipeline-editor-footer"><button class="btn btn-primary" onclick="savePipelineEditor()">Guardar etapas</button></div>`;
}

function openNewPipelineForm() {
  openModal('Crear nuevo pipeline', `<form onsubmit="createPipelineFromForm(event)">
    <p class="text-muted" style="margin-bottom:16px;">Crea un tablero independiente. Después podrás agregar etapas, pasos y reglas.</p>
    <div class="form-grid">
      <div class="form-group"><label>Clave interna</label><input name="key" required pattern="[a-z0-9][a-z0-9_-]{1,60}" placeholder="ej. ventas_locales"></div>
      <div class="form-group"><label>Nombre visible</label><input name="name" required placeholder="Ej. Pipeline de ventas"></div>
      <div class="form-group"><label>Tipo de registros</label><select name="entity_type"><option value="proyectos">Proyectos</option><option value="prospectos">Prospectos</option><option value="tareas">Tareas</option></select></div>
      <div class="form-group full"><label>Etapas iniciales</label><textarea name="stages" rows="5" required placeholder="Una etapa por línea&#10;Ejemplo:&#10;Nuevo&#10;En proceso&#10;Ganado"></textarea><small class="text-muted">Después de crear el pipeline, las configuraciones existentes son de solo lectura.</small></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" type="submit">Crear pipeline</button></div>
  </form>`);
}

async function createPipelineFromForm(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const key = form.key.value.trim().toLowerCase();
  const entityType = form.entity_type.value;
  const stageNames = form.stages.value.split('\n').map(value => value.trim()).filter(Boolean);
  if (!stageNames.length) { showToast('Agrega al menos una etapa', true); button.disabled = false; return; }
  const stageValues = entityType === 'tareas' ? ['Pendiente', 'En Proceso', 'Terminado'] : entityType === 'prospectos' ? ['Nuevo', 'En Proceso', 'Cerrado', 'Perdido'] : stageNames.map((_, index) => String(index + 1));
  const pipelineSeed = Date.now();
  const stageIds = stageNames.map((_, index) => `STG-${pipelineSeed}-${index}`);
  try {
    const response = await fetch(`${API}/api/pipelines`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Name': 'Administrador', 'X-Source': 'pipeline_creator' }, body: JSON.stringify({
      key, name: form.name.value.trim(), entity_type: entityType, status: 'draft', active: true,
      stages: stageNames.map((stageName, index) => ({ stage_id: stageIds[index], stage_key: stageName.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: stageName, type: 'stage', order_index: index, active: true, is_initial: index === 0, is_terminal: index === stageNames.length - 1, legacy_value: stageValues[index] || stageName, conditions: [], actions: [], steps: [] })),
       transitions: stageNames.slice(1).flatMap((_, index) => [
         { transition_id: `TR-${pipelineSeed}-${index}-forward`, from_stage_id: stageIds[index], to_stage_id: stageIds[index + 1], event_key: 'stage_changed', order_index: index * 2, active: true, conditions: [], actions: [] },
         { transition_id: `TR-${pipelineSeed}-${index}-backward`, from_stage_id: stageIds[index + 1], to_stage_id: stageIds[index], event_key: 'stage_changed', order_index: index * 2 + 1, active: true, conditions: [], actions: [] }
       ])
    }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo crear el pipeline');
    closeModal();
    showToast('Pipeline creado y publicado');
    await loadAvailablePipelines();
    await openPipelineManager(result.key || key);
  } catch (error) { showToast(error.message, true); button.disabled = false; }
}

function renderPipelineCatalog(definitions) {
  const container = document.getElementById('pipelineEditorBody');
  if (!container) return;
   container.innerHTML = `<div class="pipeline-readonly-list">${definitions.map(definition => { const isBase = ['proyectos', 'prospectos', 'tareas'].includes(definition.key); return `<article class="pipeline-readonly-card"><div><strong>${escapeDetailHtml(definition.name)}</strong><span>${escapeDetailHtml(definition.key)} · ${escapeDetailHtml(definition.entity_type)}</span></div><div class="pipeline-readonly-meta"><span class="badge badge-${definition.status === 'published' ? 'green' : 'orange'}">${definition.status === 'published' ? 'Publicado' : 'Borrador'}</span><span>${definition.stages.filter(stage => stage.active !== false).length} etapas</span><span>v${definition.version}</span></div><div class="pipeline-readonly-stages">${definition.stages.filter(stage => stage.active !== false).sort((a, b) => a.order_index - b.order_index).map((stage, index) => `<span>${index + 1}. ${escapeDetailHtml(stage.name)}</span>`).join('')}</div><div class="pipeline-card-actions"><button class="btn btn-outline btn-small" onclick="openPipelineStageEditor(decodeURIComponent('${encodeURIComponent(definition.key)}'))"><i class="ph ph-pencil-simple"></i> Editar etapas</button>${isBase ? '<span class="text-muted pipeline-protected-label">Pipeline base protegido</span>' : `<button class="btn btn-outline btn-small btn-danger-outline" onclick="deletePipelineFromCatalog(decodeURIComponent('${encodeURIComponent(definition.key)}'), decodeURIComponent('${encodeURIComponent(definition.name)}'))"><i class="ph ph-trash"></i> Borrar</button>`}</div></article>`; }).join('')}</div>`;
}

async function deletePipelineFromCatalog(key, name) {
  if (!confirm(`¿Borrar el pipeline "${name}"? Se eliminarán sus etapas, reglas e historial de estados.`)) return;
  try {
    const response = await fetch(`${API}/api/pipelines/${encodeURIComponent(key)}`, { method: 'DELETE', headers: { 'X-User-Name': 'Administrador', 'X-Source': 'pipeline_catalog' } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo borrar el pipeline');
    delete window.pipelineEditorState.definitions[key];
    delete window.pipelineConfigs[key];
    showToast('Pipeline borrado correctamente');
    await loadAvailablePipelines();
    await openPipelineManager();
  } catch (error) { showToast(error.message, true); }
}

function openPipelineStageEditor(key) {
  const definition = window.pipelineEditorState.definitions[key];
  if (!definition) return;
  window.pipelineEditorState.selectedKey = key;
  openModal(`Editar etapas: ${definition.name}`, '<div id="pipelineEditorBody"></div>');
  renderSimplePipelineEditor();
}

function renderSimplePipelineEditor() {
  const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
  const container = document.getElementById('pipelineEditorBody');
  if (!definition || !container) return;
  const stages = [...definition.stages].sort((a, b) => a.order_index - b.order_index);
  container.innerHTML = `
    <div class="simple-pipeline-help"><i class="ph ph-info"></i><span>Solo modifica el orden y los datos visibles de las etapas. Guarda cuando termines.</span></div>
    <div class="simple-pipeline-list">
      ${stages.map((stage, index) => `<article class="simple-stage-card">
        <div class="simple-stage-top"><span class="simple-stage-number">${index + 1}</span><div class="simple-stage-heading"><strong>${escapeDetailHtml(stage.name)}</strong><small>Valor guardado: ${escapeDetailHtml(stage.legacy_value || stage.stage_key)}</small></div><div class="simple-stage-actions"><button class="btn btn-outline btn-small" title="Subir" onclick="moveSimplePipelineStage('${encodeURIComponent(stage.stage_id)}',-1)" ${index === 0 ? 'disabled' : ''}>↑</button><button class="btn btn-outline btn-small" title="Bajar" onclick="moveSimplePipelineStage('${encodeURIComponent(stage.stage_id)}',1)" ${index === stages.length - 1 ? 'disabled' : ''}>↓</button></div></div>
        <div class="simple-stage-fields"><label>Nombre visible<input value="${escapeDetailHtml(stage.name)}" onchange="updateSimplePipelineStage('${encodeURIComponent(stage.stage_id)}','name',this.value)"></label><label>Valor persistido<input value="${escapeDetailHtml(stage.legacy_value || stage.stage_key)}" onchange="updateSimplePipelineStage('${encodeURIComponent(stage.stage_id)}','legacy_value',this.value)"></label><label class="simple-check"><input type="checkbox" ${stage.active !== false ? 'checked' : ''} onchange="updateSimplePipelineStage('${encodeURIComponent(stage.stage_id)}','active',this.checked)"> Activa</label><label class="simple-check"><input type="checkbox" ${stage.is_initial ? 'checked' : ''} onchange="setSimpleInitialStage('${encodeURIComponent(stage.stage_id)}')"> Inicial</label></div>
      </article>`).join('')}
    </div>
    <div class="simple-pipeline-footer"><span>${stages.length} etapas · ${definition.status === 'published' ? 'Publicado' : 'Borrador'}</span><button class="btn btn-primary" onclick="savePipelineEditor()"><i class="ph ph-check"></i> Guardar etapas</button></div>`;
}

function updateSimplePipelineStage(stageId, field, value) {
  const stage = pipelineEditorStage(stageId);
  if (!stage) return;
  stage[field] = field === 'active' ? Boolean(value) : value;
  if (field === 'name' && !String(value).trim()) showToast('El nombre de la etapa no puede estar vacío', true);
}

function setSimpleInitialStage(stageId) {
  const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
  if (!definition) return;
  const selectedId = pipelineEditorId(stageId);
  definition.stages.forEach(stage => { stage.is_initial = stage.stage_id === selectedId; });
  renderSimplePipelineEditor();
}

function moveSimplePipelineStage(stageId, direction) {
  const definition = window.pipelineEditorState.definitions[window.pipelineEditorState.selectedKey];
  if (!definition) return;
  const stages = [...definition.stages].sort((a, b) => a.order_index - b.order_index);
  const index = stages.findIndex(stage => stage.stage_id === pipelineEditorId(stageId));
  const target = index + direction;
  if (index < 0 || target < 0 || target >= stages.length) return;
  [stages[index], stages[target]] = [stages[target], stages[index]];
  stages.forEach((stage, order) => { stage.order_index = order; });
  definition.stages = stages;
  renderSimplePipelineEditor();
}

async function openPipelineManager(preferredKey = null) {
  try {
    const response = await fetch(`${API}/api/pipelines`);
    const definitions = await response.json();
    window.pipelineEditorState.definitions = Object.fromEntries(definitions.map(definition => [definition.key, JSON.parse(JSON.stringify(definition))]));
    window.pipelineEditorState.invalidJson = false;
    const defaultKey = currentTablero === 'pipeline-prospectos' ? 'prospectos' : currentTablero === 'tareas' ? 'tareas' : 'proyectos';
    window.pipelineEditorState.selectedKey = preferredKey && window.pipelineEditorState.definitions[preferredKey] ? preferredKey : defaultKey;
    const selector = `<div class="pipeline-manager-header"><div><strong>Pipelines existentes: solo lectura</strong><p class="text-muted">Para cambiar el flujo crea un pipeline nuevo.</p></div><button class="btn btn-primary" type="button" onclick="openNewPipelineForm()"><i class="ph ph-plus"></i> Nuevo pipeline</button></div><div id="pipelineEditorBody"></div>`;
    openModal('Pipelines', selector);
    renderPipelineCatalog(definitions);
  } catch (error) {
    showToast('No se pudo cargar la configuración de pipelines', true);
  }
}

async function persistPipelineEditorDefinition() {
  const key = window.pipelineEditorState.selectedKey;
  const definition = window.pipelineEditorState.definitions[key];
  if (!definition) return null;
  if (window.pipelineEditorState.invalidJson) { showToast('Corrige el JSON inválido antes de guardar', true); return null; }
  const response = await fetch(`${API}/api/pipelines/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-User-Name': 'Administrador', 'X-Source': 'pipeline_editor' }, body: JSON.stringify(definition) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { showToast(result.error || 'No se pudo guardar el pipeline', true); return null; }
  window.pipelineConfigs[key] = result;
  window.pipelineEditorState.definitions[key] = result;
  return result;
}

async function savePipelineEditor() {
  const result = await persistPipelineEditorDefinition();
  if (!result) return;
  closeModal();
  showToast('Configuración guardada');
  delete window.pipelineConfigs[window.pipelineEditorState.selectedKey];
  await loadTableroView(currentTablero);
}

async function publishPipelineEditor() {
  const key = window.pipelineEditorState.selectedKey;
  const saved = await persistPipelineEditorDefinition();
  if (!saved) return;
  const response = await fetch(`${API}/api/pipelines/${encodeURIComponent(key)}/publish`, { method: 'POST', headers: { 'X-User-Name': 'Administrador', 'X-Source': 'pipeline_editor' } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { showToast(result.error || 'No se pudo publicar el pipeline', true); return; }
  window.pipelineEditorState.definitions[key] = result;
  window.pipelineConfigs[key] = result;
  renderPipelineEditor();
  showToast('Nueva versión publicada');
  await loadTableroView(currentTablero);
}

// ── PAGOS Y GASTOS ────────────────────────────────────────────────
window.pagosGastosData = [];
async function loadPagosGastos() {
  window.pagosGastosData = await fetch(`${API}/api/pagos_gastos`).then(r => r.json());
  const data = window.pagosGastosData;

  const tbody = document.querySelector('#tablePagosGastos tbody');
  tbody.innerHTML = data.length ? data.map(r => `
    <tr class="clickable-row" onclick="editRecord('pagos_gastos', '${r['ID'] || ''}')">
      <td><input type="checkbox" class="row-checkbox" value="${r['ID'] || ''}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-${(r['Tipo'] || 'Gasto') === 'Gasto' ? 'red' : 'green'}">${r['ID'] || '—'}</span></td>
      <td><span class="badge badge-${(r['Tipo'] || '') === 'Gasto' ? 'red' : 'blue'}">${r['Tipo'] || '—'}</span></td>
      <td>${r['Fecha'] || '—'}</td>
      <td><strong>${r['Descripción'] || '—'}</strong></td>
      <td>${r['Categoría'] || '—'}</td>
      <td><strong>$${parseFloat(r['Monto'] || 0).toLocaleString()}</strong></td>
      <td>${r['Método de Pago'] || '—'}</td>
      <td title="${r['Notas'] || ''}">${truncate(r['Notas'], 30)}</td>
      <td>${r['Fecha de Registro'] || '—'}</td>
    </tr>`).join('') : emptyState();

  actualizarResumenPg();
}

function formPagosGastos(data = {}) {
  const fechaVal = data['Fecha'] || new Date().toISOString().split('T')[0];
  return `<form id="modalForm" onsubmit="submitForm(event, 'pagos_gastos')">
    <div class="form-grid">
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" name="fecha" value="${fechaVal}" required>
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select name="tipo" required>
          <option value="">Seleccionar...</option>
          <option ${data['Tipo'] === 'Ingreso' ? 'selected' : ''}>Ingreso</option>
          <option ${data['Tipo'] === 'Gasto' ? 'selected' : ''}>Gasto</option>
        </select>
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <input type="text" name="descripcion" value="${data['Descripción'] || ''}" placeholder="Ej. Pago de diseño web" required>
      </div>
      <div class="form-group">
        <label>Categoría</label>
        <input type="text" name="categoria" value="${data['Categoría'] || ''}" placeholder="Ej. Servicios" required>
      </div>
      <div class="form-group">
        <label>Monto ($)</label>
        <input type="number" name="monto" step="0.01" min="0" value="${data['Monto'] || ''}" placeholder="0.00" required>
      </div>
      <div class="form-group">
        <label>Método de Pago</label>
        <select name="metodo" required>
          <option value="">Seleccionar...</option>
          ${['Transferencia','Efectivo','Tarjeta Débito','Tarjeta Crédito','PayPal','Otro'].map(o => `<option ${data['Método de Pago'] === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:span 2;">
        <label>Notas</label>
        <input type="text" name="notas" value="${data['Notas'] || ''}" placeholder="Notas opcionales">
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Guardar</button>
  </form>`;
}

function filterTableByTipo(tipo) {
  const rows = document.querySelectorAll('#tablePagosGastos tbody tr');
  rows.forEach(row => {
    if (!tipo) { row.style.display = ''; return; }
    const tipoCell = row.cells[1]?.textContent || '';
    row.style.display = tipoCell === tipo ? '' : 'none';
  });
}

function actualizarResumenPg() {
  const data = window.pagosGastosData || [];
  const pagos = data.filter(r => ['Pago', 'Ingreso'].includes(r['Tipo'])).reduce((s, r) => s + parseFloat(r['Monto'] || 0), 0);
  const gastos = data.filter(r => r['Tipo'] === 'Gasto').reduce((s, r) => s + parseFloat(r['Monto'] || 0), 0);
  const balance = pagos - gastos;
  const fmt = v => '$' + v.toLocaleString();
  const el = id => document.getElementById(id);
  if (el('pg-total-pagos')) el('pg-total-pagos').textContent = fmt(pagos);
  if (el('pg-total-gastos')) el('pg-total-gastos').textContent = fmt(gastos);
  if (el('pg-balance')) el('pg-balance').textContent = fmt(balance);
}

function descargarVoucher(record) {
  if (!record) { showToast('Selecciona un registro para descargar', true); return; }
  const r = {
    id: record.id || record.ID || record['ID'] || '—',
    fecha: record.fecha || record['Fecha'] || '—',
    tipo: record.tipo || record['Tipo'] || '—',
    concepto: record.concepto || record.descripcion || record['Descripción'] || '—',
    monto: record.monto || record['Monto'] || 0,
    metodo: record.metodo || record['Método de Pago'] || '—',
    clienteProveedor: record.categoria || record['Categoría'] || '—',
    responsable: record.fechaRegistro || record['Fecha de Registro'] || '—',
    notas: record.notas || record['Notas'] || '—',
  };
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: [80, 120] });
  const pageWidth = 80;

  doc.setFontSize(14);
  doc.text('VOUCHER', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Pago / Gasto', pageWidth / 2, 18, { align: 'center' });

  doc.setDrawColor(200);
  doc.line(6, 21, 74, 21);

  doc.setFontSize(8);
  const lines = [
    `Folio:          ${r.id}`,
    `Fecha:          ${r.fecha}`,
    `Tipo:           ${r.tipo}`,
    `Concepto:       ${r.concepto}`,
    `Monto:          $${parseFloat(r.monto || 0).toLocaleString()}`,
    `Metodo:         ${r.metodo}`,
    `Categoria:      ${r.clienteProveedor}`,
    `Fecha Registro: ${r.responsable}`,
    `Notas:          ${r.notas}`,
  ];
  lines.forEach((l, i) => doc.text(l, 8, 30 + i * 5.5));

  doc.line(6, 88, 74, 88);
  doc.setFontSize(6);
  doc.text('Sistema ERP LumarK Group', pageWidth / 2, 93, { align: 'center' });

  doc.save(`voucher_${(r.concepto || 'voucher').replace(/\s+/g, '_')}.pdf`);
}

function descargarBalance() {
  const data = window.pagosGastosData || [];
  if (!data.length) { showToast('No hay datos para generar balance', true); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text('Balance de Pagos y Gastos', pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Generado el ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });

  const totalPagos = data.filter(r => r['Tipo'] === 'Pago').reduce((s, r) => s + parseFloat(r['Monto'] || 0), 0);
  const totalGastos = data.filter(r => r['Tipo'] === 'Gasto').reduce((s, r) => s + parseFloat(r['Monto'] || 0), 0);
  const balance = totalPagos - totalGastos;

  doc.setFontSize(11);
  doc.text(`Total Ingresos: $${totalPagos.toLocaleString()}`, 14, 32);
  doc.text(`Total Gastos: $${totalGastos.toLocaleString()}`, 14, 39);
  doc.text(`Balance:      $${balance.toLocaleString()}`, 14, 46);

  const tableData = data.map(r => [
    r['Tipo'] || '',
    r['Fecha'] || '',
    r['ID'] || '',
    r['Descripción'] || '',
    r['Categoría'] || '',
    `$${parseFloat(r['Monto'] || 0).toLocaleString()}`,
    r['Método de Pago'] || '',
    truncate(r['Notas'], 25),
    r['Fecha de Registro'] || ''
  ]);

  doc.autoTable({
    startY: 52,
    head: [['Tipo', 'Fecha', 'ID', 'Descripción', 'Categoría', 'Monto', 'Método', 'Notas', 'Fecha Registro']],
    body: tableData,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save(`balance_${new Date().toISOString().split('T')[0]}.pdf`);
}

window.correosProspectosSeleccionados = new Set();
window.correosProspectosData = [];

function escapeCorreoHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function isValidCorreo(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function loadCorreos() {
  window.correosProspectosData = await fetch(`${API}/api/correos/prospectos`).then(r => r.json()).catch(() => []);
  renderProspectosCorreo();
  const status = await fetch(`${API}/api/correos/auth/status`).then(r => r.json()).catch(() => ({ configured: false, authorized: false }));
  const statusEl = document.getElementById('correoAuthStatus');
  if (!statusEl) return;
  if (status.authorized) {
    statusEl.innerHTML = '<div style="background:#ecfdf5;color:#065f46;padding:12px 16px;border-radius:8px;">Gmail autorizado para envío.</div>';
  } else if (status.configured) {
    statusEl.innerHTML = '<div style="background:#fff7ed;color:#9a3412;padding:12px 16px;border-radius:8px;">Gmail requiere autorización. <a href="/api/auth/gmail" style="font-weight:600;text-decoration:underline;">Conectar Gmail</a></div>';
  } else {
    statusEl.innerHTML = '<div style="background:#fef2f2;color:#991b1b;padding:12px 16px;border-radius:8px;">Falta configurar GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET.</div>';
  }
}

function renderProspectosCorreo() {
  const list = document.getElementById('correo-prospectos-list');
  if (!list) return;
  const query = (document.getElementById('correo-prospectos-search')?.value || '').toLowerCase();
  const prospects = (window.correosProspectosData || []).filter(p => isValidCorreo(p.email)).filter(p => {
    const text = [p.name, p.email, p.segment].join(' ').toLowerCase();
    return text.includes(query);
  });
  list.innerHTML = prospects.length ? prospects.map(p => {
    const id = p.prospect_id || '';
    const email = p.email || '';
    const checked = window.correosProspectosSeleccionados.has(id) ? 'checked' : '';
    return `<label style="display:flex;gap:8px;align-items:flex-start;padding:9px 4px;border-bottom:1px solid #e5e7eb;cursor:pointer;">
      <input type="checkbox" value="${escapeCorreoHtml(id)}" ${checked} onchange="toggleProspectoCorreo('${escapeCorreoHtml(id)}', this.checked)">
      <span><strong>${escapeCorreoHtml(p.name || 'Sin nombre')}</strong><br><small>${escapeCorreoHtml(email || 'Sin correo')} · ${escapeCorreoHtml(p.segment || 'Sin segmento')}</small></span>
    </label>`;
  }).join('') : '<p class="text-muted">No hay prospectos que coincidan.</p>';
  actualizarConteoProspectosCorreo();
}

function filtrarProspectosCorreo() { renderProspectosCorreo(); }

function toggleProspectoCorreo(id, checked) {
  if (checked) window.correosProspectosSeleccionados.add(id);
  else window.correosProspectosSeleccionados.delete(id);
  actualizarConteoProspectosCorreo();
}

function toggleTodosProspectosCorreo() {
  const query = (document.getElementById('correo-prospectos-search')?.value || '').toLowerCase();
  (window.correosProspectosData || []).forEach(p => {
    const text = [p.name, p.email, p.segment].join(' ').toLowerCase();
    if (text.includes(query) && isValidCorreo(p.email)) window.correosProspectosSeleccionados.add(p.prospect_id);
  });
  renderProspectosCorreo();
}

function actualizarConteoProspectosCorreo() {
  const count = document.getElementById('correo-prospectos-count');
  if (count) count.textContent = `${window.correosProspectosSeleccionados.size} seleccionados`;
}

function obtenerPayloadCorreo() {
  return {
    subject: document.getElementById('correo-asunto').value.trim(),
    html_body: document.getElementById('correo-html').value,
    text_body: document.getElementById('correo-texto').value,
    recipients: (window.correosProspectosData || []).filter(p => window.correosProspectosSeleccionados.has(p.prospect_id) && isValidCorreo(p.email)).map(p => ({ name: p.name || '', email: p.email, prospect_id: p.prospect_id }))
  };
}

async function guardarBorradorCorreo() {
  const feedback = document.getElementById('correo-send-feedback');
  const payload = obtenerPayloadCorreo();
  if (!payload.subject) { feedback.textContent = 'Escribe un asunto para guardar el borrador.'; return; }
  const response = await fetch(`${API}/api/correos/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const result = await response.json();
  feedback.textContent = response.ok ? `Borrador guardado: ${result.campaign_id}` : (result.error || 'No se pudo guardar el borrador');
  showToast(response.ok ? `Borrador guardado: ${result.campaign_id}` : (result.error || 'No se pudo guardar el borrador'), !response.ok);
}

function switchCorreoEditor(mode) {
  document.getElementById('correo-editor-html')?.classList.toggle('hidden', mode !== 'html');
  document.getElementById('correo-editor-texto')?.classList.toggle('hidden', mode !== 'texto');
}

async function enviarCampanaCorreo(event) {
  event.preventDefault();
  const button = document.getElementById('correo-send-button');
  const feedback = document.getElementById('correo-send-feedback');
  const body = obtenerPayloadCorreo();
  const recipients = body.recipients;
  if (!body.subject || (!body.html_body && !body.text_body) || !recipients.length) {
    feedback.textContent = 'Asunto, contenido y al menos un prospecto con correo son obligatorios.';
    return;
  }
  button.disabled = true;
  feedback.textContent = `Enviando ${recipients.length} correo(s)...`;
  try {
    const response = await fetch(`${API}/api/correos/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || 'Error al enviar la campaña');
      error.reconnectRequired = result.reconnect_required;
      error.authUrl = result.auth_url;
      throw error;
    }
    const stats = result.send_stats || {};
    feedback.textContent = `Campaña ${result.campaign_id}: ${stats.sent || 0} aceptados por Gmail, ${stats.failed || 0} fallidos.`;
    if (stats.errors?.length) feedback.textContent += ` Primer error: ${stats.errors[0].email} (${stats.errors[0].message})`;
    showToast(
      stats.failed
        ? `Envío parcial: ${stats.sent || 0} aceptados por Gmail, ${stats.failed} fallidos.`
        : `Gmail aceptó ${stats.sent || 0} correo(s) para envío.`,
      Boolean(stats.failed)
    );
  } catch (error) {
    if (error.reconnectRequired) {
      feedback.innerHTML = `Gmail necesita autorización en este servidor. <a href="${error.authUrl || '/api/auth/gmail'}" style="font-weight:600;text-decoration:underline;">Conectar Gmail</a>`;
      showToast('Gmail necesita autorización antes de enviar.', true);
    } else {
      feedback.textContent = error.message;
      showToast(`No se enviaron los correos: ${error.message}`, true);
    }
  } finally {
    button.disabled = false;
  }
}


// Patch generateOptions to support preselected value
const _origGenerateOptions = window.generateOptions || function(dataStore, idKey, nameKey) {
  const data = window[dataStore] || [];
  return data.map(d => `<option value="${d[idKey]}">${d[nameKey]}</option>`).join('');
};
window.generateOptions = function(dataStore, idKey, nameKey, selectedVal) {
  const data = window[dataStore] || [];
  if (selectedVal === undefined) {
    return _origGenerateOptions(dataStore, idKey, nameKey);
  }
  return data.map(d => `<option value="${d[idKey]}" ${d[idKey] === selectedVal ? 'selected' : ''}>${d[nameKey]}</option>`).join('');
};
