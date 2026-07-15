// ── GLOBALS ───────────────────────────────────────────────────────
// Note: API, escapeHtml, debounce, showToast, etc. come from js/utils/helpers.js
// This file keeps backward compatibility with the monolithic version.
var currentSection = 'dashboard';
var escapeHtml2 = window.escapeHtml || escapeHtml;

// Chart instance registry to prevent memory leaks
function renderBarChart(canvasId, dataObj, labelStr, colorHex) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }

    const labels = Object.keys(dataObj);
    const data = Object.values(dataObj);

    chartInstances[canvasId] = new Chart(ctx, {
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
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }

    const labels = Object.keys(dataObj);
    const data = Object.values(dataObj);

    chartInstances[canvasId] = new Chart(ctx, {
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

if (typeof MAPPING === 'undefined') { var MAPPING = {
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
  nombrenegocio: ['Nombre del Negocio'],
  giro: ['Giro'],
  cantidad: ['Cantidad'],
  indicador: ['Indicador'],
  proximaaccion: ['Próxima acción']
};

if (typeof ETAPAS_MAP === 'undefined') { var ETAPAS_MAP = {
  '1': '1 → Activación',
  '2': '2 → Diagnóstico',
  '3': '3 → Calendario de Contenido',
  '4': '4 → Creación de Contenido',
  '5': '5 → Campaña',
  '6': '6 → Reporte de Resultados',
  '7': '<i class="ph-bold ph-arrows-clockwise" style="vertical-align:middle; margin-right:4px;"></i> Renovación'
};
} // end if ETAPAS_MAP undefined

function formatEtapa(val) {
  return ETAPAS_MAP[String(val)] || val || '—';
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
  
  const endpoint = currentSection === 'pipeline' ? 'pipeline_de_proyecto' : currentSection;
  
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
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${section}`)?.classList.remove('hidden');
  document.getElementById(`nav-${section}`)?.classList.add('active');
  
  document.getElementById('btnAdd').style.display = (section === 'dashboard' || section === 'citas') ? 'none' : 'inline-block';
  document.getElementById('btnDeleteMode').style.display = (section === 'dashboard' || section === 'citas') ? 'none' : 'inline-block';
  if (isDeleteMode) toggleDeleteMode();

  const titles = {
    dashboard: ['Dashboard', 'Vista general del negocio'],
    prospectos: ['Prospectos', 'Contactos en seguimiento'],
    clientes: ['Clientes', 'Base de clientes activos'],
    proyectos: ['Proyectos', 'Control de proyectos activos'],
    pipeline: ['Pipeline', 'Etapas de entrega por proyecto'],
    tareas: ['Tareas', 'Pendientes del equipo'],
    citas: ['Agenda', 'Agenda de reuniones'],

    actividades: ['Registrar Actividad', 'Agrega tu avance del día'],
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

// ── LOAD SECTION ─────────────────────────────────────────────────
function loadSection(section) {
  // Bug 09: Limpiar selección al cambiar de pestaña
  selectedIds.clear();
  isDeleteMode = false;
  
  const loaders = {
    dashboard: loadDashboard,
    prospectos: loadProspectos,
    clientes: loadClientes,
    proyectos: loadProyectos,
    pipeline: loadPipeline,
    tareas: loadTareas,
    citas: loadCitas,
    actividades: loadActividades,
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
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json());
  window.prospectosData = await fetch(`${API}/api/prospectos`).then(r => r.json());
  loadPipelineProspectos();
  renderProspectosTable();
}

function renderProspectosTable() {
  const data = filterByDate(window.prospectosData);

  // ── Botón de Campaña movido a index.html estático ──────────

  const tbody = document.querySelector('#tableProspectos tbody');
  tbody.innerHTML = data.length ? data.map(r => {
    const esc = (key1, key2) => escapeHtml(r[key1] || (key2 ? r[key2] : '') || '');
    return `
    <tr class="clickable-row" onclick="viewRecord('prospectos', '${esc('ID Prospectos')}')">
      <td><input type="checkbox" class="row-checkbox" value="${esc('ID Prospectos')}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"></td>
      <td><strong>${esc('Nombre del Contacto', 'Nombre') || '—'}</strong></td>
      <td><strong>${esc('Nombre del Negocio', 'nombreNegocio') || '—'}</strong></td>
      <td>${esc('Correo Electrónico', 'Correo') || '—'}</td>
      <td>${esc('Teléfono') || '—'}</td>
      <td><span class="badge badge-blue">${esc('Medio de contacto') || '—'}</span></td>
      <td>${esc('Fecha de Registro') || '—'}</td>
      <td title="${esc('Notas')}">${truncate(esc('Notas'), 40)}</td>
      <td>${esc('Asesor') || '—'}</td>
      <td>${esc('Situacion') || '—'}</td>
      <td>${esc('Problema') || '—'}</td>
      <td>${esc('Implicacion') || '—'}</td>
      <td>${esc('Necesidad') || '—'}</td>
      <td>${esc('Giro') || '—'}</td>
    </tr>`;
  }).join('') : emptyState();
}

// ── CLIENTES ─────────────────────────────────────────────────────
window.clientesData = [];
async function loadClientes() {
  window.clientesData = await fetch(`${API}/api/clientes`).then(r => r.json());
  renderClientes();
}

function renderClientes() {
  const data = filterByDate(window.clientesData);
  const tbody = document.querySelector('#tableClientes tbody');
  tbody.innerHTML = data.length ? data.map(r => {
    const esc = (k) => escapeHtml(r[k] || '');
    return `
    <tr class="clickable-row" onclick="viewRecord('clientes', '${esc('ID Clientes')}')">
      <td><input type="checkbox" class="row-checkbox" value="${esc('ID Clientes')}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"></td>
      <td><strong>${esc('Nombre del Cliente') || '—'}</strong></td>
      <td>${esc('Empresa o Razón Social') || '—'}</td>
      <td>${esc('Correo Electrónico') || '—'}</td>
      <td>${esc('Teléfono Principal') || '—'}</td>
      <td>${statusBadge(esc('Estado'))}</td>
      <td>${esc('Servicios contratados') || '—'}</td>
      <td>${r['Valor mensual'] ? '$' + parseFloat(r['Valor mensual']).toLocaleString() : '—'}</td>
      <td>${priorityBadge(esc('Prioridad'))}</td>
      <td>${esc('Giro') || '—'}</td>
    </tr>`;
  }).join('') : emptyState();
}

// ── PROYECTOS ────────────────────────────────────────────────────
window.proyectosData = [];
async function loadProyectos() {
  if (!window.citasData || window.citasData.length === 0) {
    try { window.citasData = await fetch(`${API}/api/citas`).then(r => r.json()); } catch(e) {}
  }
  window.proyectosData = await fetch(`${API}/api/proyectos`).then(r => r.json());
  renderProyectos();
}

function renderProyectos() {
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

    const esc = (k) => escapeHtml(r[k] || '');
    return `<tr class="clickable-row" onclick="viewRecord('proyectos', '${esc('ID Proyectos')}')">
      <td><input type="checkbox" class="row-checkbox" value="${esc('ID Proyectos')}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"></td>
      <td><strong>${esc('Nombre del Proyecto') || '—'}</strong></td>
      <td>${escapeHtml(clientName)}</td>
      <td>${esc('Servicio') || '—'}</td>
      <td style="white-space:nowrap; font-weight:600; color:var(--text2);">${escapeHtml(nextMeeting)}</td>
      <td>
        <select class="pill-select ${estadoClase}" onclick="event.stopPropagation()" onchange="updateProyectoSelect('${r['ID Proyectos']}','estado','Estado del Proyecto',this.value); this.className='pill-select '+({'Activo':'pill-estado-activo','Reunión':'pill-estado-reunion','Cerrado':'pill-estado-cerrado'}[this.value]||'pill-estado-default')">
          <option value="Activo"  ${r['Estado del Proyecto'] === 'Activo'  ? 'selected' : ''}>Activo</option>
          <option value="Reunión" ${r['Estado del Proyecto'] === 'Reunión' || r['Estado del Proyecto'] === 'Detenido' ? 'selected' : ''}>Reunión</option>
          <option value="Cerrado" ${r['Estado del Proyecto'] === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
        </select>
      </td>
      <td>
        <select class="pill-select pill-etapa" onclick="event.stopPropagation()" onchange="updateProyectoSelect('${r['ID Proyectos']}','etapa','Etapa actual',this.value)">
          <option value="1" ${String(r['Etapa actual']) === '1' ? 'selected' : ''}>1 → Activación</option>
          <option value="2" ${String(r['Etapa actual']) === '2' ? 'selected' : ''}>2 → Diagnóstico</option>
          <option value="3" ${String(r['Etapa actual']) === '3' ? 'selected' : ''}>3 → Calendario</option>
          <option value="4" ${String(r['Etapa actual']) === '4' ? 'selected' : ''}>4 → Contenido</option>
          <option value="5" ${String(r['Etapa actual']) === '5' ? 'selected' : ''}>5 → Campaña</option>
          <option value="6" ${String(r['Etapa actual']) === '6' ? 'selected' : ''}>6 → Reporte</option>
          <option value="7" ${String(r['Etapa actual']) === '7' ? 'selected' : ''}>↺ Renovación</option>
        </select>
      </td>
      <td><div style="font-weight:700;color:#3b82f6;">${r['% Avance'] || '0%'}</div></td>
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
    const res = await fetch(`${API}/api/proyectos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [payloadKey]: val })
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || `Error al actualizar ${payloadKey}`); }
    showToast('Actualizado correctamente');
    
    // Update memory
    const record = window.proyectosData.find(r => Object.values(r).includes(id));
    if (record) record[memKey] = val;

    // ── WEBHOOK DISPATCH (cambio inline en proyectos) ────────────────
    if (typeof dispatchWebhook === 'function') {
      // Build enriched data with the updated field + full project context
      const updatedRecord = record ? { ...record, [memKey]: val } : { id, [memKey]: val };
      dispatchWebhook('proyectos', 'update', id, updatedRecord);
    }
    // ────────────────────────────────────────────────────────────────
    
    loadProyectos(); // re-render table
  } catch(err) {
    showToast(err.message, true);
    loadProyectos(); // revert changes if error
  }
}

// ── PIPELINE ─────────────────────────────────────────────────────
window.pipelineData = [];
async function loadPipeline() {
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json());
  if (!window.tareasData || window.tareasData.length === 0) {
    try { window.tareasData = await fetch(`${API}/api/tareas`).then(r => r.json()); } catch(e) {}
  }
  window.pipelineData = await fetch(`${API}/api/proyectos`).then(r => r.json());
  renderPipeline();
}

function renderPipeline() {
  const data = filterByDate(window.pipelineData);
  const board = document.getElementById('kanban-pipeline');
  
  board.querySelectorAll('.kanban-cards').forEach(el => el.innerHTML = '');
  board.querySelectorAll('.kanban-count').forEach(el => el.textContent = '0');

  data.forEach(r => {
    // Determine which column to place the project in, based on Etapa actual
    const etapa = r['Etapa actual'] || '1'; 
    const col = board.querySelector(`.kanban-col[data-status="${etapa}"] .kanban-cards`);
    if (!col) return;
    
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', r['ID Proyectos']);
    
    card.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: r['ID Proyectos'], type: 'proyectos' }));
      e.target.style.opacity = '0.5';
    });
    card.addEventListener('dragend', e => {
      e.target.style.opacity = '1';
    });

    let clientName = r['Cliente Relacionado'] || '—';
    if (clientName.startsWith('CLI-') && window.clientesData) {
      const c = window.clientesData.find(x => x['ID Clientes'] === clientName);
      if (c) clientName = c['Nombre del Cliente'] || clientName;
    }

    let linkedTasksHtml = '';
    if (window.tareasData && window.tareasData.length > 0) {
      const linked = window.tareasData.filter(t => 
        t['ID Proyecto'] === r['ID Proyectos'] && 
        (t['Estado'] === 'Pendiente' || t['Estado'] === 'En Proceso')
      );
      if (linked.length > 0) {
        linkedTasksHtml = '<div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--border);">';
        linkedTasksHtml += '<div style="font-size:10px; font-weight:700; color:var(--text2); margin-bottom:8px; text-transform:uppercase;">Tareas Activas:</div>';
        linked.forEach(t => {
          const badgeClass = t['Estado'] === 'En Proceso' ? 'badge-blue' : 'badge-orange';
          linkedTasksHtml += `
            <div style="font-size:11.5px; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              
              <span style="color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${t['Tarea'] || ''}">${t['Tarea'] || '—'}</span>
            </div>
          `;
        });
        linkedTasksHtml += '</div>';
      }
    }

    const esc = (k) => escapeHtml(r[k] || '');
    card.innerHTML = `
      <div class="kanban-card-header">
        <input type="checkbox" class="row-checkbox" value="${esc('ID Proyectos')}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)">
        <span class="kanban-card-date">${esc('Próxima reunión') || 'Sin reunión'}</span>
      </div>
      <div class="kanban-card-title">${esc('Nombre del Proyecto') || '—'}</div>
      <div class="kanban-card-body">
        <p><strong>Cliente:</strong> ${escapeHtml(clientName)}</p>
        <p><strong>Servicio:</strong> ${esc('Servicio') || '—'}</p>
        <p title="${esc('Notas')}">${truncate(esc('Notas'), 30)}</p>
        ${linkedTasksHtml}
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-resp">Avance: ${esc('% Avance') || '0%'}</span>
        <button class="kanban-move-btn" onclick="event.stopPropagation(); showMoveMenu(this.closest('.kanban-card'), '${esc('ID Proyectos')}', 'proyectos')" title="Mover de etapa">
          <i class="ph ph-arrows-left-right"></i>
        </button>
        ${pipelineStatusBadge(esc('Estado del Proyecto'))}
      </div>
    `;
    // Click on card body opens record details (but not on drag)
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('.row-checkbox') || ev.target.closest('.kanban-move-btn')) return;
      viewRecord('proyectos', r['ID Proyectos']);
    });
    col.appendChild(card);
  });

  board.querySelectorAll('.kanban-col').forEach(col => {
    const count = col.querySelectorAll('.kanban-card').length;
    col.querySelector('.kanban-count').textContent = count;
  });
}

// ── PIPELINE PROSPECTOS ──────────────────────────────────────────
async function loadPipelineProspectos() {
  window.prospectosData = await fetch(`${API}/api/prospectos`).then(r => r.json());
  
  const board = document.getElementById('kanban-pipeline-prospectos');
  
  board.querySelectorAll('.kanban-cards').forEach(el => el.innerHTML = '');
  board.querySelectorAll('.kanban-count').forEach(el => el.textContent = '0');

  window.prospectosData.forEach(r => {
    const etapa = r['Etapa'] || 'Nuevo'; 
    const col = board.querySelector(`.kanban-col[data-status="${etapa}"] .kanban-cards`);
    if (!col) return;
    
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', r['ID Prospectos']);
    
    card.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: r['ID Prospectos'], type: 'prospectos_pipeline' }));
      e.target.style.opacity = '0.5';
    });
    card.addEventListener('dragend', e => {
      e.target.style.opacity = '1';
    });

    const prospectName = r['Nombre del Contacto'] || r['Nombre'] || '—';

    const esc = (k) => escapeHtml(r[k] || '');
    card.innerHTML = `
      <div class="kanban-card-header">
        <span class="kanban-card-date">${esc('Fecha de Registro') || ''}</span>
      </div>
      <div class="kanban-card-title">${escapeHtml(prospectName)}</div>
      <div class="kanban-card-body">
        <p><strong>Asesor:</strong> ${esc('Asesor') || '—'}</p>
        <p title="${esc('Notas')}">${truncate(esc('Notas'), 40)}</p>
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-resp">${esc('Medio de contacto') || ''}</span>
        <button class="kanban-move-btn" onclick="event.stopPropagation(); showMoveMenu(this.closest('.kanban-card'), '${esc('ID Prospectos')}', 'prospectos_pipeline')" title="Mover de etapa">
          <i class="ph ph-arrows-left-right"></i>
        </button>
      </div>
    `;
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('.kanban-move-btn')) return;
      viewRecord('prospectos', r['ID Prospectos']);
    });
    col.appendChild(card);
  });

  board.querySelectorAll('.kanban-col').forEach(col => {
    const count = col.querySelectorAll('.kanban-card').length;
    col.querySelector('.kanban-count').textContent = count;
  });
}

function switchPipeline(type) {
  const btnProyectos = document.getElementById('tab-pipeline-proyectos');
  const btnProspectos = document.getElementById('tab-pipeline-prospectos');
  const containerProyectos = document.getElementById('pipeline-proyectos-container');
  const containerProspectos = document.getElementById('pipeline-prospectos-container');
  
  if (type === 'proyectos') {
    btnProyectos.classList.add('active');
    btnProspectos.classList.remove('active');
    
    containerProyectos.style.display = 'block';
    containerProspectos.style.display = 'none';
    loadPipeline();
  } else {
    btnProspectos.classList.add('active');
    btnProyectos.classList.remove('active');
    
    containerProspectos.style.display = 'block';
    containerProyectos.style.display = 'none';
    loadPipelineProspectos();
  }
}

// ── TAREAS ───────────────────────────────────────────────────────
window.tareasData = [];
async function loadTareas() {
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json());
  window.tareasData = await fetch(`${API}/api/tareas`).then(r => r.json());
  const data = filterByDate(window.tareasData);
  const board = document.getElementById('kanban-tareas');
  
  board.querySelectorAll('.kanban-cards').forEach(el => el.innerHTML = '');
  board.querySelectorAll('.kanban-count').forEach(el => el.textContent = '0');

  data.forEach(r => {
    const estado = r['Estado'] || 'Pendiente';
    const col = board.querySelector(`.kanban-col[data-status="${estado}"] .kanban-cards`);
    if (!col) return;

    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', r['ID Tarea']);
    
    card.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: r['ID Tarea'], type: 'tareas' }));
      e.target.style.opacity = '0.5';
    });
    card.addEventListener('dragend', e => {
      e.target.style.opacity = '1';
    });

    const esc = (k) => escapeHtml(r[k] || '');
    card.innerHTML = `
      <div class="kanban-card-header">
        <input type="checkbox" class="row-checkbox" value="${esc('ID Tarea')}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)">
        ${priorityBadge(esc('Prioridad'))}
      </div>
      <div class="kanban-card-title">${esc('Tarea') || '—'}</div>
      <div class="kanban-card-body">
        <p><strong>Cat:</strong> ${esc('Categoría') || '—'}</p>
        <p><strong>Proyecto:</strong> ${esc('ID Proyecto') || '—'}</p>
        <p><strong>Límite:</strong> ${esc('Fecha límite') || '—'}</p>
        ${r['Comentarios'] ? `<p title="${esc('Comentarios')}">${truncate(esc('Comentarios'), 40)}</p>` : ''}
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-resp">${esc('Responsable') || '—'}</span>
        <button class="kanban-move-btn" onclick="event.stopPropagation(); showMoveMenu(this.closest('.kanban-card'), '${esc('ID Tarea')}', 'tareas')" title="Mover estado">
          <i class="ph ph-arrows-left-right"></i>
        </button>
        ${taskStatusBadge(escapeHtml(estado))}
      </div>
    `;
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('.row-checkbox') || ev.target.closest('.kanban-move-btn')) return;
      viewRecord('tareas', r['ID Tarea']);
    });
    col.appendChild(card);
  });

  board.querySelectorAll('.kanban-col').forEach(col => {
    const count = col.querySelectorAll('.kanban-card').length;
    col.querySelector('.kanban-count').textContent = count;
  });
}

// ── CITAS ────────────────────────────────────────────────────────
let calendarInstance = null;
async function loadCitas() {
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json());
  window.citasData = await fetch(`${API}/api/citas`).then(r => r.json());
  const data = filterByDate(window.citasData);
  
  const events = data.map(r => {
    let dateStr = r['Fecha'] || r['Fecha de la Cita'];
    if (dateStr && dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }

    let startStr = dateStr;
    const horaRaw = r['Hora'] || r['Hora de la Cita'];
    
    if (horaRaw && dateStr) {
        const timeParts = horaRaw.split(':');
        const hh = timeParts[0].padStart(2, '0');
        const mm = (timeParts[1] || '00').padStart(2, '0');
        startStr = `${dateStr}T${hh}:${mm}`;
    }

    return {
      id: r['ID Citas'],
      title: escapeHtml(r['Nombre'] || r['Nombre/Tema'] || 'Cita'),
      start: startStr,
      extendedProps: {
        tipo: escapeHtml(r['Tipo'] || r['Tipo de reunión']),
        responsable: escapeHtml(r['Responsable']),
        proyecto: escapeHtml(r['ID Proyecto']),
        cliente: escapeHtml(r['ID Cliente']),
        notas: escapeHtml(r['Notas'] || r['Resultado'])
      }
    };
  });
  const calendarEl = document.getElementById('calendar');
  if (calendarEl) {
    if (calendarInstance) calendarInstance.destroy();

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      events: events,
      eventClick: function(info) {
        viewRecord('citas', info.event.id);
      }
    });
    
    calendarInstance.render();
  }
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
    window.citasData = await fetch(`${API}/api/citas`).then(r => r.json()).catch(() => []);
    window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json()).catch(() => []);
    window.prospectosData = await fetch(`${API}/api/prospectos`).then(r => r.json()).catch(() => []);
    window.tareasData = await fetch(`${API}/api/tareas`).then(r => r.json()).catch(() => []);
    window.actividadesData = await fetch(`${API}/api/actividades`).then(r => r.json()).catch(() => []);
    
    const clientes = filterByDate(Array.isArray(window.clientesData) ? window.clientesData : []);
    const proyectos = filterByDate(Array.isArray(window.proyectosData) ? window.proyectosData : []);
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
    proyectos.forEach(p => {
      let rawE = p['Etapa actual'] || '1';
      let e = rawE;
      if (['1','2','3','4','5','6','7'].includes(String(rawE))) {
        e = formatEtapa(rawE).replace(/<[^>]*>?/gm, ''); // Remove HTML
        if (e.includes('→')) e = e.split('→')[1].trim(); // Clean text
      }
      pipelineEtapas[e] = (pipelineEtapas[e] || 0) + 1;
      
      const d = p['Días sin movimiento'];
      if(d && !isNaN(parseInt(d))) {
          sumTiempo += parseInt(d);
          countTiempo++;
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
function openModal(title, body) {
  if (!title && !body) {
    // If called without arguments, open the 'Nuevo Registro' form for current section
    title = 'Nuevo Registro';
    switch(currentSection) {
      case 'clientes': body = formCliente(); break;
      case 'prospectos': body = formProspecto(); break;
      case 'proyectos': body = formProyecto(); break;
      case 'pipeline': body = formPipeline(); break;
      case 'tareas': body = formTarea(); break;
      case 'citas': body = formCita(); break;
      case 'actividades': body = formActividad(); break;
      default: body = '<p class="text-muted">No hay formulario disponible para esta sección.</p>';
    }
  }
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
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
      <div class="form-group"><label>Asesor</label>
        <select name="asesor">
          <option value="">Selecciona Asesor...</option>
          ${generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor')}
        </select>
      </div>
      <div class="form-group"><label>Medio de Contacto</label>
        <select name="medioDeContacto">
          <option value="">Seleccionar...</option>
          <option value="Whatsapp">Whatsapp</option>
          <option value="Redes sociales">Redes sociales</option>
          <option value="Recomendación">Recomendación</option>
          <option value="Llamada">Llamada</option>
          <option value="Evento">Evento</option>
        </select>
      </div>
      <div class="form-group"><label>Nombre del Negocio</label><input name="nombreNegocio"></div>
      <div class="form-group"><label>Giro</label><input name="giro"></div>
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

function generateOptions(dataStore, idKey, nameKey) {
  if (!window[dataStore] || !window[dataStore].length) return '<option value="">Cargando / Sin datos...</option>';
  return window[dataStore].map(r => `<option value="${r[idKey]}">${r[nameKey]}</option>`).join('');
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
          <option value="1">1 → Activación</option>
          <option value="2">2 → Diagnóstico</option>
          <option value="3">3 → Calendario de Contenido</option>
          <option value="4">4 → Creación de Contenido</option>
          <option value="5">5 → Campaña</option>
          <option value="6">6 → Reporte de Resultados</option>
          <option value="7"><i class="ph-bold ph-arrows-clockwise" style="vertical-align:middle; margin-right:4px;"></i> Renovación</option>
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
        <select name="estado"><option>Pendiente</option><option>En Proceso</option><option>Terminado</option></select></div>
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
      closeModal();
      showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i> Registro guardado en Google Sheets');
      // ── WEBHOOK DISPATCH ─────────────────────────────────────
      const triggerSrc = id ? 'update' : 'create';
      const recordId   = id || result.id || result.newId || null;
      if (typeof dispatchWebhook === 'function') {
        dispatchWebhook(endpoint, triggerSrc, recordId, body);
      }
      // ─────────────────────────────────────────────────────────
      loadSection(currentSection);
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

// ── TABLE FILTER (debounced) ──────────────────────────────────────
const filterTable = (function() {
  let timer;
  return function(tableId, query) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = query.toLowerCase();
      const rows = document.querySelectorAll(`#${tableId} tbody tr`);
      rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }, 200);
  };
})();

const filterKanban = (function() {
  let timer;
  return function(boardId, query) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = query.toLowerCase();
      const cards = document.querySelectorAll(`#${boardId} .kanban-card`);
      cards.forEach(card => {
        card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }, 200);
  };
})();

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
  if (!toast) return;
  // Use innerHTML so icons render correctly
  toast.innerHTML = msg;
  toast.style.borderColor = isError ? 'var(--red)' : 'var(--green)';
  toast.style.color = isError ? 'var(--red)' : 'var(--green)';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ── INIT ──────────────────────────────────────────────────────────
window.initLegacyApp = function() {
  loadDashboard();
  initKanbanDragDrop();
};

function initKanbanDragDrop() {
  const cols = document.querySelectorAll('.kanban-col');
  cols.forEach(col => {
    // Prevent attaching multiple times if initKanbanDragDrop is called again
    if (col.dataset.dragAttached) return;
    col.dataset.dragAttached = 'true';

    col.addEventListener('dragover', e => { 
      e.preventDefault(); 
      col.style.background = '#eef2ff'; 
    });
    
    col.addEventListener('dragleave', e => { 
      col.style.background = '#f4f5f7'; 
    });
    
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.style.background = '#f4f5f7';
      const newStatus = col.getAttribute('data-status');
      if (!newStatus) return;
      
      try {
        const textData = e.dataTransfer.getData('text/plain');
        if (!textData) { showToast('Error drag: No dataTransfer', true); return; }
        
        let data;
        try {
          data = JSON.parse(textData);
        } catch (err) {
          showToast('DataTransfer no es JSON válido', true);
          return;
        }

        const { id, type } = data;
        let record = null;
        let endpoint = '';
        
        if (type === 'proyectos') {
          record = window.pipelineData.find(r => String(r['ID Proyectos']).trim() === String(id).trim());
          endpoint = 'proyectos';
        } else if (type === 'tareas') {
          record = window.tareasData.find(r => String(r['ID Tarea']).trim() === String(id).trim());
          endpoint = 'tareas';
        } else if (type === 'prospectos_pipeline') {
          record = window.prospectosData.find(r => String(r['ID Prospectos']).trim() === String(id).trim());
          endpoint = 'prospectos';
        }
        
        const isProyectos = type === 'proyectos';
        const isProspectos = type === 'prospectos_pipeline';
        
        let currentStatus = '';
        if (isProyectos) currentStatus = record['Etapa actual'];
        else if (isProspectos) currentStatus = record['Etapa'];
        else currentStatus = record['Estado'];
        
        if (!record || String(currentStatus).trim() === String(newStatus).trim()) return;
        
        const payload = {};
        if (isProyectos) {
          payload.etapa = newStatus;
          record['Etapa actual'] = newStatus;
          // Optimistic UI update without fetching stale data
          renderPipeline();
        } else if (isProspectos) {
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
        
        if (!res.ok) { 
          const errData = await res.json().catch(()=>({})); 
          throw new Error(errData.message || errData.error || 'Error al guardar el estado'); 
        }
        
        // ── WEBHOOK DISPATCH (kanban drag) ───────────────────
        if (typeof dispatchWebhook === 'function') {
          dispatchWebhook(endpoint, 'update', id, { ...payload, id });
        }
        // ────────────────────────────────────────────────────
        
        showToast('Guardado correctamente');
        // Reload from server just like original code
        if (isProyectos) await loadPipeline(); 
        else if (isProspectos) await loadPipelineProspectos(); 
        else await loadTareas();
        
      } catch (err) { 
        showToast(err.message, true); 
        // Revert UI on error
        if (type === 'proyectos') await loadPipeline(); 
        else if (type === 'prospectos_pipeline') await loadPipelineProspectos(); 
        else await loadTareas();
      }
    });
  });
}

// Click-to-move logic
async function handleKanbanMoveClick(id, type, newStatus) {
  let record = null;
  let endpoint = '';

  if (type === 'proyectos') {
    record = (window.pipelineData || []).find(r => String(r['ID Proyectos']).trim() === String(id).trim());
    endpoint = 'proyectos';
  } else if (type === 'tareas') {
    record = (window.tareasData || []).find(r => String(r['ID Tarea']).trim() === String(id).trim());
    endpoint = 'tareas';
  } else if (type === 'prospectos_pipeline') {
    record = (window.prospectosData || []).find(r => String(r['ID Prospectos']).trim() === String(id).trim());
    endpoint = 'prospectos';
  }

  if (!record) return;

  const isProyectos = type === 'proyectos';
  const isProspectos = type === 'prospectos_pipeline';

  let currentStatus = '';
  if (isProyectos) currentStatus = String(record['Etapa actual'] || '1');
  else if (isProspectos) currentStatus = String(record['Etapa'] || 'Nuevo');
  else currentStatus = String(record['Estado'] || '');

  if (String(currentStatus).trim() === String(newStatus).trim()) return;

  const payload = {};
  if (isProyectos) {
    payload.etapa = newStatus;
    record['Etapa actual'] = newStatus;
    loadPipeline();
  } else if (isProspectos) {
    payload.etapa = newStatus;
    record['Etapa'] = newStatus;
    loadPipelineProspectos();
  } else {
    payload.estado = newStatus;
    record['Estado'] = newStatus;
    loadTareas();
  }

  showToast(`Moviendo a etapa ${newStatus}...`);

  try {
    const res = await fetch(`${API}/api/${endpoint}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || errBody.message || `Error HTTP ${res.status}`);
    }

    if (typeof dispatchWebhook === 'function') {
      dispatchWebhook(endpoint, 'update', id, { ...payload, id });
    }

    showToast('✅ ¡Etapa actualizada!');
    if (isProyectos) await loadPipeline();
    else if (isProspectos) await loadPipelineProspectos();
    else await loadTareas();
  } catch (err) {
    showToast(`❌ Error: ${err.message}`, true);
    if (isProyectos) await loadPipeline();
    else if (isProspectos) await loadPipelineProspectos();
    else await loadTareas();
  }
}

// Click-to-move menu popover
function showMoveMenu(cardElement, id, type) {
  document.querySelectorAll('.kanban-move-menu').forEach(m => m.remove());

  let columns = [];
  if (type === 'proyectos') {
    columns = [
      { value: '1', label: '1 → Activación' },
      { value: '2', label: '2 → Diagnóstico' },
      { value: '3', label: '3 → Calendario' },
      { value: '4', label: '4 → Creación Cont.' },
      { value: '5', label: '5 → Campaña' },
      { value: '6', label: '6 → Reporte' },
      { value: '7', label: '7 → Renovación' },
    ];
  } else if (type === 'prospectos_pipeline') {
    columns = [
      { value: 'Nuevo', label: 'Nuevo' },
      { value: 'En proceso', label: 'En proceso' },
      { value: 'En espera', label: 'En espera' },
      { value: 'Ganando', label: 'Ganando' },
      { value: 'Cancelado', label: 'Cancelado' },
    ];
  } else if (type === 'tareas') {
    columns = [
      { value: 'Pendiente', label: 'Pendiente' },
      { value: 'En Proceso', label: 'En Proceso' },
      { value: 'Terminado', label: 'Terminado' },
    ];
  }

  const menu = document.createElement('div');
  menu.className = 'kanban-move-menu';
  menu.style.cssText = 'position:absolute;z-index:999;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.15);padding:8px 4px;min-width:180px;';
  
  const title = document.createElement('div');
  title.textContent = 'Mover a etapa:';
  title.style.cssText = 'font-size:11px;font-weight:700;color:#94a3b8;padding:4px 12px 8px;text-transform:uppercase;letter-spacing:0.5px;';
  menu.appendChild(title);

  columns.forEach(col => {
    const btn = document.createElement('button');
    btn.textContent = col.label;
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;font-size:13px;color:#334155;border-radius:6px;transition:background 0.15s;';
    btn.onmouseover = () => btn.style.background = '#f1f5f9';
    btn.onmouseout = () => btn.style.background = 'none';
    btn.onclick = async (ev) => {
      ev.stopPropagation();
      menu.remove();
      handleKanbanMoveClick(id, type, col.value);
    };
    menu.appendChild(btn);
  });

  const rect = cardElement.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.left = rect.right + 'px';
  menu.style.top = rect.top + 'px';
  
  document.body.appendChild(menu);
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = (rect.left - menuRect.width) + 'px';
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = (window.innerHeight - menuRect.height - 10) + 'px';
  }

  setTimeout(() => {
    document.addEventListener('click', function closeMenu(ev) {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 10);
}

// ── RECORD VIEW AND EDIT LOGIC ────────────────────────────────────
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

  const allMappedColumns = Object.values(MAPPING).flat().map(c => c.toLowerCase());
  
  let html = `<div class="record-details-grid">`;
  Object.keys(record).forEach(k => {
    if (k === '_rowIndex') return;
    
    // Hide IDs completely from frontend
    if (k.toLowerCase().startsWith('id ')) return;
    
    const isMapped = allMappedColumns.includes(k.toLowerCase());
    if (!isMapped) return;
    
    const val = record[k] || '—';
    const isMuted = val === '—' || val.trim() === '';
    
    let displayVal = val;
    if (k === 'Etapa actual') displayVal = formatEtapa(val);
    
    let isEditable = true;
    if (endpoint === 'tareas' && k !== 'Estado' && k !== 'Comentarios') {
      isEditable = false;
    }

    if (!isEditable) {
      html += `
        <div class="detail-item" style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
          <div class="detail-label" style="font-weight: 900; font-size: 13px; margin-bottom: 4px; color: #000000;">${k}</div>
          <div class="detail-value ${isMuted ? 'text-muted' : ''}" style="padding: 4px; color: #1e293b; font-weight: 500;">
            ${displayVal}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="detail-item" style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
          <div class="detail-label" style="font-weight: 900; font-size: 13px; margin-bottom: 4px; color: #000000;">${k}</div>
          <div class="detail-value ${isMuted ? 'text-muted' : ''} editable-field" 
               style="cursor: pointer; padding: 4px; border-radius: 4px; transition: background 0.2s;"
               onmouseover="this.style.background='#f0f4f8'" 
               onmouseout="this.style.background='transparent'"
               onclick="makeEditable(this, '${endpoint}', '${id}', '${k}', \`${val.replace(/"/g, '&quot;')}\`)">
            ${displayVal} <i class="ph ph-pencil-simple" style="font-size: 0.8em; opacity: 0.5; margin-left: 5px;"></i>
          </div>
        </div>
      `;
    }
  });
  let convertButtonHtml = '';
  if (endpoint === 'prospectos') {
    convertButtonHtml = `
      <button class="btn btn-primary" style="background: linear-gradient(135deg, #10b981, #059669); border:none; display: flex; align-items: center; gap: 6px;" 
              onclick="convertToCliente('${id}')">
        <i class="ph ph-user-plus"></i> Convertir a Cliente
      </button>
    `;
  }

  html += `
    <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
      ${convertButtonHtml}
      <button class="btn btn-outline" style="border-color: #fecaca; color: #b91c1c; background: #fef2f2; display: flex; align-items: center; gap: 6px;" 
              onclick="deleteRecord('${endpoint}', '${id}')">
        <i class="ph ph-trash"></i> Eliminar Registro
      </button>
    </div>
  </div>`;
  
  // Find a suitable name for the title using the known 'nombre' mappings
  let nameForTitle = id; // fallback
  if (MAPPING.nombre) {
    const matchingKey = Object.keys(record).find(k => MAPPING.nombre.map(m => m.toLowerCase()).includes(k.toLowerCase()));
    if (matchingKey && record[matchingKey]) {
      nameForTitle = record[matchingKey];
    }
  }
  
  openModal(`Detalles: ${nameForTitle}`, html);
}

async function convertToCliente(prospectId) {
  if (!confirm('¿Convertir este prospecto a cliente? Esto creará un nuevo cliente y eliminará el prospecto.')) return;
  
  const prospecto = window.prospectosData.find(p => p['ID Prospectos'] === prospectId);
  if (!prospecto) {
    showToast('Prospecto no encontrado', true);
    return;
  }
  
  const payload = {
    nombre: prospecto['Nombre del Contacto'] || prospecto['Nombre'] || '',
    empresa: prospecto['Nombre del Negocio'] || prospecto['nombreNegocio'] || '',
    correo: prospecto['Correo Electrónico'] || prospecto['Correo'] || '',
    telefono: prospecto['Teléfono'] || '',
    estado: 'Activo',
    giro: prospecto['Giro'] || '',
    prioridad: 'Media',
    notas: `Convertido desde prospecto. ${prospecto['Notas'] || ''}`
  };
  
  showToast('Convirtiendo a cliente...');
  try {
    const res = await fetch(`${API}/api/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      await fetch(`${API}/api/prospectos/${prospectId}`, { method: 'DELETE' });
      showToast('¡Prospecto convertido a cliente!');
      closeModal();
      refreshData();
    } else {
      showToast('Error al crear el cliente', true);
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

function makeEditable(el, endpoint, id, sheetKey, originalVal) {
  if (el.querySelector('input') || el.querySelector('select')) return; // Already editing
  
  if (originalVal === '—') originalVal = '';
  
  let input;
  if (sheetKey === 'Estado' || sheetKey === 'Prioridad' || sheetKey === 'Estatus' || sheetKey === 'Riesgo' || sheetKey === 'Etapa actual' || sheetKey === 'Etapa') {
    input = document.createElement('select');
    let opts = [];
    if (sheetKey === 'Estado') {
      if (endpoint === 'tareas') opts = ['Pendiente', 'En Proceso', 'Terminado'];
      else if (endpoint === 'pipeline_de_proyecto') opts = ['En Proceso', 'Completado', 'Bloqueado'];
      else if (endpoint === 'proyectos') opts = ['Activo', 'Reunión', 'Cerrado'];
      else opts = ['Activo', 'Pausado', 'Baja'];
    }
    if (sheetKey === 'Etapa actual' || sheetKey === 'Etapa') {
      if (endpoint === 'proyectos') opts = ['1', '2', '3', '4', '5', '6', '7'];
      else if (endpoint === 'prospectos') opts = ['Nuevo', 'Contactado', 'Reunión Agendada', 'Propuesta Enviada', 'Negociación', 'Ganado', 'Perdido'];
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
      // ── WEBHOOK DISPATCH (inline edit) ───────────────────
      if (typeof dispatchWebhook === 'function') {
        dispatchWebhook(endpoint, 'update', id, { [sheetKey]: newVal, id });
      }
      // ────────────────────────────────────────────────────
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
    default: showToast('Formulario no disponible', true); return;
  }
  
  openModal(`Editar: ${id}`, html);
  
  setTimeout(() => {
    const form = document.querySelector('#modal-content form');
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
      showToast('Registro eliminado exitosamente');
      closeModal();
      
      // Reload the corresponding view
      if (endpoint === 'clientes') loadClientes();
      else if (endpoint === 'prospectos') {
        loadProspectos();
        if (currentSection === 'pipeline_prospectos') loadPipelineProspectos();
      }
      else if (endpoint === 'proyectos') {
        loadProyectos();
        if (currentSection === 'pipeline_de_proyecto') loadPipeline();
      }
      else if (endpoint === 'tareas') loadTareas();
      else if (endpoint === 'citas') loadCitas();
      else if (endpoint === 'actividades') loadActividades();
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
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json()).catch(() => []);
  const selectResp = document.getElementById('act-responsable');
  if (selectResp && selectResp.options.length <= 1) {
    selectResp.innerHTML = '<option value="">Selecciona Asesor...</option>' + generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor');
  }

  window.actividadesData = await fetch(`${API}/api/actividades`).then(r => r.json()).catch(() => []);
  const data = filterByDate(window.actividadesData);
  
  const statsDiv = document.getElementById('actividadesStats');
  if (!statsDiv) return;

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
    notas: document.getElementById('act-notas').value
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
    submitBtn.textContent = 'Guardar Actividad';
  }
}
// ── CALENDLY INTEGRATION ──────────────────────────────────────────
window.addEventListener('message', async (e) => {
  let data = e.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch(err) { return; }
  }
  
  if (data && data.event && data.event.includes('calendly')) {
    console.log('Calendly Event:', data.event, data.payload);
  }

  if (data && data.event === 'calendly.event_scheduled') {
    const eventUri = data.payload.event.uri;
    const inviteeUri = data.payload.invitee.uri;
    
    try {
      showToast('Sincronizando cita de Calendly...', false);
      const res = await fetch(`${API}/api/sync-calendly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventUri, inviteeUri })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar cita');
      showToast('Cita guardada en Google Sheets');
      
      // Fire the webhook for n8n just like the old modal form did
      if (typeof dispatchWebhook === 'function') {
         dispatchWebhook('citas', 'create', data.id, data.data);
      }
      
      loadCitas(); // Refresh data in background
    } catch(err) {
      showToast(err.message, true);
    }
  }
});
