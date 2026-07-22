// ── GLOBALS ───────────────────────────────────────────────────────
const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
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
  
  document.getElementById('btnAdd').style.display = (section === 'dashboard' || section === 'tableros') ? 'none' : 'inline-block';
  document.getElementById('btnDeleteMode').style.display = (section === 'dashboard' || section === 'tableros') ? 'none' : 'inline-block';
  if (isDeleteMode) toggleDeleteMode();

  const titles = {
    dashboard: ['Dashboard', 'Vista general del negocio'],
    prospectos: ['Prospectos', 'Contactos en seguimiento'],
    clientes: ['Clientes', 'Base de clientes activos'],
    proyectos: ['Proyectos', 'Control de proyectos activos'],
    tableros: ['Tableros', 'Pipeline y tareas'],
    citas: ['Citas', 'Agenda de reuniones'],
    actividades: ['Registrar Actividad', 'Agrega tu avance del día'],
    cotizaciones: ['Cotizaciones', 'Cotizaciones y presupuestos'],
    archivos: ['Archivos', 'Documentos y archivos del negocio'],
    pagos_gastos: ['Pagos y Gastos', 'Control de ingresos y egresos'],
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
    tableros: loadTableros,
    citas: loadCitas,
    actividades: loadActividades,
    cotizaciones: loadCotizaciones,
    archivos: loadArchivos,
    pagos_gastos: loadPagosGastos,
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
  const data = filterByDate(window.prospectosData);

  // ── Botón de Campaña movido a index.html estático ──────────

  const tbody = document.querySelector('#tableProspectos tbody');
  tbody.innerHTML = data.length ? data.map(r => `
    <tr class="clickable-row" onclick="viewRecord('prospectos', '${r['ID Prospectos'] || ''}')">
      <td><input type="checkbox" class="row-checkbox" value="${r['ID Prospectos'] || ''}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)"><span class="badge badge-purple">${r['ID Prospectos'] || '—'}</span></td>
      <td><strong>${r['Nombre del Contacto'] || '—'}</strong></td>
      <td>${r['Correo Electrónico'] || '—'}</td>
      <td>${r['Teléfono'] || '—'}</td>
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
              <span class="badge ${badgeClass}" style="font-size:9.5px; padding:2px 5px;">${t['ID Tarea']}</span>
              <span style="color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${t['Tarea'] || ''}">${t['Tarea'] || '—'}</span>
            </div>
          `;
        });
        linkedTasksHtml += '</div>';
      }
    }

    card.innerHTML = `
      <div class="kanban-card-header" onclick="viewRecord('proyectos', '${r['ID Proyectos']}')">
        <input type="checkbox" class="row-checkbox" value="${r['ID Proyectos']}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)">
        <span class="badge badge-purple">${r['ID Proyectos'] || '—'}</span>
        <span class="kanban-card-date">${r['Próxima reunión'] || 'Sin reunión'}</span>
      </div>
      <div class="kanban-card-title" onclick="viewRecord('proyectos', '${r['ID Proyectos']}')">${r['Nombre del Proyecto'] || '—'}</div>
      <div class="kanban-card-body" onclick="viewRecord('proyectos', '${r['ID Proyectos']}')">
        <p><strong>Cliente:</strong> ${clientName}</p>
        <p><strong>Servicio:</strong> ${r['Servicio'] || '—'}</p>
        <p title="${r['Notas'] || ''}">${truncate(r['Notas'], 30)}</p>
        ${linkedTasksHtml}
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-resp">Avance: ${r['% Avance'] || '0%'}</span>
        ${pipelineStatusBadge(r['Estado del Proyecto'])}
      </div>
    `;
    col.appendChild(card);
  });

  board.querySelectorAll('.kanban-col').forEach(col => {
    const count = col.querySelectorAll('.kanban-card').length;
    col.querySelector('.kanban-count').textContent = count;
  });
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
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: r['ID Tarea'], type: 'tareas' }));
      e.target.style.opacity = '0.5';
    });
    card.addEventListener('dragend', e => {
      e.target.style.opacity = '1';
    });

    card.innerHTML = `
      <div class="kanban-card-header" onclick="viewRecord('tareas', '${r['ID Tarea']}')">
        <input type="checkbox" class="row-checkbox" value="${r['ID Tarea']}" onclick="event.stopPropagation(); toggleSelection(this.value, this.checked)">
        <span class="badge badge-orange">${r['ID Tarea'] || '—'}</span>
        ${priorityBadge(r['Prioridad'])}
      </div>
      <div class="kanban-card-title" onclick="viewRecord('tareas', '${r['ID Tarea']}')">${r['Tarea'] || '—'}</div>
      <div class="kanban-card-body" onclick="viewRecord('tareas', '${r['ID Tarea']}')">
        <p><strong>Cat:</strong> ${r['Categoría'] || '—'}</p>
        <p><strong>Proyecto:</strong> ${r['ID Proyecto'] || '—'}</p>
        <p><strong>Límite:</strong> ${r['Fecha límite'] || '—'}</p>
        ${r['Comentarios'] ? `<p title="${r['Comentarios']}">${truncate(r['Comentarios'], 40)}</p>` : ''}
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-resp">${r['Responsable'] || '—'}</span>
        ${taskStatusBadge(estado)}
      </div>
    `;
    col.appendChild(card);
  });

  board.querySelectorAll('.kanban-col').forEach(col => {
    const count = col.querySelectorAll('.kanban-card').length;
    col.querySelector('.kanban-count').textContent = count;
  });
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
      case 'cotizaciones': body = formCotizacion(); break;
      case 'pagos_gastos': body = formPagosGastos(); break;
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
        // ── WEBHOOK DISPATCH (kanban drag) ───────────────────
        if (typeof dispatchWebhook === 'function') {
          dispatchWebhook(endpoint, 'update', id, { ...payload, id });
        }
        // ────────────────────────────────────────────────────
        showToast('Guardado correctamente');
        if (isProyectos) await loadPipeline(); else await loadTareas();
      } catch (err) { showToast(err.message, true); }
    });
  });
});

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
    
    // Only show columns that are mapped in the frontend forms or are ID columns
    const isIdCol = k.toLowerCase().startsWith('id ');
    const isMapped = allMappedColumns.includes(k.toLowerCase());
    if (!isIdCol && !isMapped) return;
    
    const val = record[k] || '—';
    const isMuted = val === '—' || val.trim() === '';
    
    let displayVal = val;
    if (k === 'Etapa actual') displayVal = formatEtapa(val);
    
    let isEditable = true;
    if (endpoint === 'tareas' && k !== 'Estado' && k !== 'Comentarios') {
      isEditable = false;
    }

    if (isIdCol || !isEditable) {
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
  html += `
    <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
      <button class="btn btn-outline" style="border-color: #fecaca; color: #b91c1c; background: #fef2f2; display: flex; align-items: center; gap: 6px;" 
              onclick="if(confirm('¿Estás seguro de eliminar este registro?')) { deleteRecord('${endpoint}', '${id}'); closeModal(); }">
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

function makeEditable(el, endpoint, id, sheetKey, originalVal) {
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
  if (!window.asesoresData) window.asesoresData = await fetch(`${API}/api/asesores`).then(r => r.json()).catch(() => []);
  window.prospectosData = await fetch(`${API}/api/prospectos`).then(r => r.json()).catch(() => []);
  const data = filterByDate(window.prospectosData);
  const board = document.getElementById('kanban-pipeline-prospectos');
  if (!board) return;

  board.querySelectorAll('.kanban-cards').forEach(el => el.innerHTML = '');
  board.querySelectorAll('.kanban-count').forEach(el => el.textContent = '0');

  data.forEach(r => {
    const etapa = r['Etapa'] || 'Nuevo';
    const col = board.querySelector(`.kanban-col[data-status="${etapa}"] .kanban-cards`);
    if (!col) return;

    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', r['ID Prospectos']);

    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: r['ID Prospectos'], type: 'prospectos' }));
      e.target.style.opacity = '0.5';
    });
    card.addEventListener('dragend', e => {
      e.target.style.opacity = '1';
    });

    card.innerHTML = `
      <div class="kanban-card-header">
        <span class="badge badge-purple">${r['ID Prospectos'] || '—'}</span>
        <span style="font-size:11px;color:var(--text2);">${r['Fecha de Registro'] || ''}</span>
      </div>
      <div class="kanban-card-title" onclick="viewRecord('prospectos', '${r['ID Prospectos'] || ''}')">${r['Nombre del Contacto'] || '—'}</div>
      <div class="kanban-card-body" onclick="viewRecord('prospectos', '${r['ID Prospectos'] || ''}')">
        <p><strong>Asesor:</strong> ${r['Asesor'] || '—'}</p>
        <p><strong>Contacto:</strong> ${r['Correo Electrónico'] || ''} ${r['Teléfono'] || ''}</p>
        <p title="${r['Notas'] || ''}">${truncate(r['Notas'], 40)}</p>
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-resp">${r['Medio de contacto'] || '—'}</span>
        <span class="badge badge-blue">${etapa}</span>
      </div>
    `;
    col.appendChild(card);
  });

  board.querySelectorAll('.kanban-col').forEach(col => {
    const count = col.querySelectorAll('.kanban-card').length;
    col.querySelector('.kanban-count').textContent = count;
  });
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
  loadTableroView(currentTablero);
}

function loadTableroView(name) {
  document.querySelectorAll('.tablero-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('tablero-' + name);
  if (panel) panel.classList.remove('hidden');

  const loaders = {
    'pipeline': loadPipeline,
    'pipeline-prospectos': loadPipelineProspectos,
    'tareas': loadTareas,
  };
  loaders[name]?.();
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
  const boardId = boardIds[currentTablero];
  if (boardId) filterKanban(boardId, query);
}

// ── PAGOS Y GASTOS ────────────────────────────────────────────────
window.pagosGastosData = [];
async function loadPagosGastos() {
  window.pagosGastosData = await fetch(`${API}/api/pagos_gastos`).then(r => r.json());
  const data = window.pagosGastosData;

  const tbody = document.querySelector('#tablePagosGastos tbody');
  tbody.innerHTML = data.length ? data.map(r => `
    <tr class="clickable-row" onclick="editRecord('pagos_gastos', '${r['ID'] || ''}')">
      <td><span class="badge badge-${(r['Tipo'] || 'Gasto') === 'Gasto' ? 'red' : 'green'}">${r['ID'] || '—'}</span></td>
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
