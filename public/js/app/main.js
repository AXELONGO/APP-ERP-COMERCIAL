// ═══════════════════════════════════════════════════════════════
// LUMARK ERP — MAIN APP (modular)
// ═══════════════════════════════════════════════════════════════

let currentSection = 'dashboard';
let isDeleteMode = false;

// ── NAVIGATION ───────────────────────────────────────────────
function navigateTo(section) {
  currentSection = section;

  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sectionEl = document.getElementById(`section-${section}`);
  if (sectionEl) sectionEl.classList.remove('hidden');

  const navEl = document.getElementById(`nav-${section}`);
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: { title: 'Dashboard', sub: 'Vista general del negocio' },
    prospectos: { title: 'Prospectos', sub: 'Gestión de leads y ventas' },
    clientes: { title: 'Clientes', sub: 'Administración de clientes' },
    proyectos: { title: 'Proyectos', sub: 'Seguimiento de proyectos' },
    pipeline: { title: 'Pipeline', sub: 'Kanban de proyectos y prospectos' },
    tareas: { title: 'Tareas', sub: 'Tablero de tareas' },
    citas: { title: 'Agenda', sub: 'Calendario de citas' },
    actividades: { title: 'Actividades', sub: 'Registro de actividades diarias' },
  };

  const info = titles[section] || { title: section, sub: '' };
  document.getElementById('pageTitle').textContent = info.title;
  document.getElementById('pageSub').textContent = info.sub;

  document.getElementById('btnAdd').style.display =
    (section !== 'dashboard' && section !== 'actividades') ? '' : 'none';

  document.getElementById('btnDeleteMode').style.display =
    (section !== 'dashboard') ? '' : 'none';

  loadSection(section);
}

function loadSection(section) {
  switch (section) {
    case 'dashboard': loadDashboard(); break;
    case 'clientes': loadClientes(); break;
    case 'prospectos': loadProspectos(); break;
    case 'proyectos': loadProyectos(); break;
    case 'pipeline': switchPipeline('proyectos'); break;
    case 'tareas': loadTareas(); break;
    case 'citas': loadCitas(); break;
    case 'actividades': loadActividades(); break;
  }
}

// ── REFRESH ──────────────────────────────────────────────────
async function refreshData() {
  invalidateCache('clientes');
  invalidateCache('prospectos');
  invalidateCache('proyectos');
  invalidateCache('pipeline_de_proyecto');
  invalidateCache('tareas');
  invalidateCache('citas');
  invalidateCache('asesores');
  invalidateCache('actividades');
  showToast('↻ Actualizando datos...');
  await loadSection(currentSection);
  showToast('✓ Datos actualizados');
}

// ── MODAL ────────────────────────────────────────────────────
function openModal(title, body) {
  if (!title && !body) {
    title = 'Nuevo Registro';
    switch (currentSection) {
      case 'clientes': body = formCliente(); break;
      case 'prospectos': body = formProspecto(); break;
      case 'proyectos': body = formProyecto(); break;
      case 'pipeline': body = formPipeline(); break;
      case 'tareas': body = formTarea(); break;
      case 'citas': body = formCita(); break;
      default: body = '<p class="text-muted">No hay formulario disponible para esta sección.</p>';
    }
  }
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal(e) {
  if (!e || !e.target || e.target.id === 'modalOverlay' || e.target.closest('.modal-close')) {
    document.getElementById('modalOverlay').classList.add('hidden');
  }
}

// ── FORM SUBMIT ──────────────────────────────────────────────
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
      invalidateCache(endpoint);
      showToast('✓ Registro guardado en Google Sheets');
      if (typeof dispatchWebhook === 'function') {
        dispatchWebhook(endpoint, id ? 'update' : 'create', id || result.id, body);
      }
      loadSection(currentSection);
    } else {
      showToast('Error: ' + (result.error || 'Desconocido'), true);
    }
  } catch (e) {
    showToast('Error de conexión', true);
  } finally {
    btn.textContent = 'Guardar';
    btn.disabled = false;
  }
}

// ── TABLE FILTER (with debounce) ─────────────────────────────
const debouncedFilterTable = debounce(function(tableId, value) {
  const q = value.toLowerCase();
  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}, 200);

function filterTable(tableId, query) {
  debouncedFilterTable(tableId, query);
}

const debouncedFilterKanban = debounce(function(boardId, query) {
  const q = query.toLowerCase();
  const cards = document.querySelectorAll(`#${boardId} .kanban-card`);
  cards.forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}, 200);

function filterKanban(boardId, query) {
  debouncedFilterKanban(boardId, query);
}

// ── DELETE MODE ──────────────────────────────────────────────
function toggleDeleteMode() {
  isDeleteMode = !isDeleteMode;
  document.body.classList.toggle('delete-mode-active', isDeleteMode);
  document.getElementById('textDeleteMode').textContent = isDeleteMode ? 'Cancelar' : 'Eliminar';
  document.querySelectorAll('.row-checkbox').forEach(cb => cb.style.display = isDeleteMode ? '' : 'none');
  document.querySelectorAll('.kanban-card .row-checkbox').forEach(cb => cb.style.display = isDeleteMode ? '' : 'none');
}

let selectedIds = new Set();

function toggleSelection(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
}

// ── DELETE SELECTED ──────────────────────────────────────────
async function deleteSelected(endpoint) {
  if (!selectedIds.size) {
    showToast('No hay registros seleccionados', true);
    return;
  }
  const msg = `¿Eliminar ${selectedIds.size} registro(s)? Esta acción no se puede deshacer.`;
  if (!confirm(msg)) return;

  let success = 0, fail = 0;
  for (const id of selectedIds) {
    try {
      const res = await fetch(`${API}/api/${endpoint}/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) success++;
      else fail++;
    } catch { fail++; }
  }
  showToast(`${success} eliminado(s), ${fail} fallido(s)`);
  selectedIds.clear();
  toggleDeleteMode();
  invalidateCache(endpoint);
  loadSection(currentSection);
}

// ── DATE FILTER ──────────────────────────────────────────────
function openDateFilter() {
  document.getElementById('dateFilterModal').classList.remove('hidden');
}

function closeDateFilter() {
  document.getElementById('dateFilterModal').classList.add('hidden');
}

function applyDateFilter() {
  const start = document.getElementById('filterDateStart').value;
  const end = document.getElementById('filterDateEnd').value;
  window.dateFilter = { start, end };
  closeDateFilter();
  loadSection(currentSection);
}

function clearDateFilter() {
  window.dateFilter = null;
  document.getElementById('filterDateStart').value = '';
  document.getElementById('filterDateEnd').value = '';
  closeDateFilter();
  loadSection(currentSection);
}

function filterByDate(data) {
  if (!window.dateFilter || !data) return data;
  const start = window.dateFilter.start;
  const end = window.dateFilter.end;
  return data.filter(item => {
    const fecha = item['Fecha de Registro'] || '';
    if (!fecha) return true;
    const iso = formatDateToISO(fecha);
    if (start && iso < start) return false;
    if (end && iso > end) return false;
    return true;
  });
}

// ── RECORD VIEW AND EDIT ────────────────────────────────────
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

  record = dataStore.find(r => Object.values(r).includes(id));

  if (!record) {
    showToast('Registro no encontrado en memoria', true);
    return;
  }

  const allMappedColumns = Object.values(MAPPING).flat().map(c => c.toLowerCase());

  let html = '<div class="record-details-grid">';
  Object.keys(record).forEach(k => {
    if (k === '_rowIndex') return;
    if (k.toLowerCase().startsWith('id ')) return;
    const isMapped = allMappedColumns.includes(k.toLowerCase());
    if (!isMapped) return;
    const val = record[k] || '—';
    const isMuted = val === '—' || val.trim() === '';

    html += `
      <div class="detail-item">
        <div class="detail-label">${escapeHtml(k)}</div>
        <div class="detail-value ${isMuted ? 'text-muted' : ''}"
             onclick="makeEditable(this, '${endpoint}', '${escapeHtml(id)}', '${escapeHtml(k)}', \`${escapeHtml(val).replace(/`/g, '\\`')}\`)">
          ${escapeHtml(k === 'Etapa actual' ? getEtapaLabel(val) : val)}
          <i class="ph ph-pencil-simple" style="font-size:0.8em;opacity:0.5;margin-left:5px;"></i>
        </div>
      </div>`;
  });

  let convertButtonHtml = '';
  if (endpoint === 'prospectos') {
    convertButtonHtml = `
      <button class="btn btn-primary" style="background:linear-gradient(135deg,#10b981,#059669);border:none;display:flex;align-items:center;gap:6px;"
              onclick="convertToCliente('${escapeHtml(id)}')">
        <i class="ph ph-user-plus"></i> Convertir a Cliente
      </button>`;
  }

  html += `
    <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px;">
      ${convertButtonHtml}
      <button class="btn btn-outline" style="border-color:#fecaca;color:#b91c1c;background:#fef2f2;display:flex;align-items:center;gap:6px;"
              onclick="deleteRecord('${endpoint}', '${escapeHtml(id)}')">
        <i class="ph ph-trash"></i> Eliminar Registro
      </button>
    </div>
  </div>`;

  let nameForTitle = id;
  if (record['Nombre del Cliente']) nameForTitle = record['Nombre del Cliente'];
  else if (record['Nombre del Contacto']) nameForTitle = record['Nombre del Contacto'];
  else if (record['Nombre del Proyecto']) nameForTitle = record['Nombre del Proyecto'];

  openModal(`Detalles: ${escapeHtml(nameForTitle)}`, html);
}

async function convertToCliente(prospectId) {
  if (!confirm('¿Convertir este prospecto a cliente? Esto creará un nuevo cliente y eliminará el prospecto.')) return;

  const prospecto = window.prospectosData.find(p => p['ID Prospectos'] === prospectId);
  if (!prospecto) { showToast('Prospecto no encontrado', true); return; }

  const payload = {
    nombre: prospecto['Nombre del Contacto'] || prospecto['Nombre'] || '',
    empresa: prospecto['Nombre del Negocio'] || '',
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
      invalidateCache('clientes');
      invalidateCache('prospectos');
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
  if (el.querySelector('input') || el.querySelector('select')) return;
  if (originalVal === '—') originalVal = '';

  let input;
  if (['Estado', 'Prioridad', 'Estatus', 'Riesgo', 'Etapa actual', 'Etapa'].includes(sheetKey)) {
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

  input.style.cssText = 'width:100%;padding:4px 8px;border:1px solid var(--blue);border-radius:4px;outline:none;';
  el.innerHTML = '';
  el.appendChild(input);
  input.focus();

  const save = async () => {
    const newVal = input.value.trim();
    if (newVal === originalVal) {
      el.innerHTML = `${escapeHtml(originalVal || '—')} <i class="ph ph-pencil-simple" style="font-size:0.8em;opacity:0.5;margin-left:5px;"></i>`;
      return;
    }
    el.innerHTML = '<span style="color:var(--text3)">Guardando...</span>';

    let mapKey = '';
    for (const [formKey, sheetHeaders] of Object.entries(MAPPING)) {
      if (sheetHeaders.includes(sheetKey)) {
        mapKey = formKey;
        if (formKey === 'asesor' && endpoint === 'tareas') mapKey = 'responsable';
        break;
      }
    }
    if (!mapKey) {
      mapKey = sheetKey.toLowerCase().replace(/ /g, '');
    }

    try {
      const res = await fetch(`${API}/api/${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [mapKey]: newVal })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || e.error || 'Error al actualizar'); }
      showToast('Actualizado correctamente');
      invalidateCache(endpoint);
      if (typeof dispatchWebhook === 'function') {
        dispatchWebhook(endpoint, 'update', id, { [sheetKey]: newVal });
      }
      const storeName = endpoint === 'pipeline_de_proyecto' ? 'pipeline' : endpoint;
      const dataStore = window[`${storeName}Data`] || [];
      const record = dataStore.find(r => Object.values(r).includes(id));
      if (record) record[sheetKey] = newVal;
      el.innerHTML = `${escapeHtml(newVal || '—')} <i class="ph ph-pencil-simple" style="font-size:0.8em;opacity:0.5;margin-left:5px;"></i>`;
    } catch (err) {
      showToast(err.message, true);
      el.innerHTML = `${escapeHtml(originalVal || '—')} <i class="ph ph-pencil-simple" style="font-size:0.8em;opacity:0.5;margin-left:5px;"></i>`;
    }
  };

  if (input.tagName === 'SELECT') input.onchange = save;
  input.onblur = save;
  input.onkeydown = e => { if (e.key === 'Enter') save(); };
}

async function deleteRecord(endpoint, id) {
  if (!confirm(`¿Estás seguro de eliminar permanentemente el registro ${id}?`)) return;
  try {
    const res = await fetch(`${API}/api/${endpoint}/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showToast('Registro eliminado');
      closeModal();
      invalidateCache(endpoint);
      loadSection(currentSection);
    } else {
      throw new Error(result.error || 'Error al eliminar');
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.section);
    });
  });

  // Sidebar toggle for mobile
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('hidden');
  });

  window.addEventListener('click', (e) => {
    if (e.target.id === 'sidebarOverlay') {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.add('hidden');
    }
  });

  document.getElementById('btnAdd')?.addEventListener('click', () => openModal());
});

window.navigateTo = navigateTo;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitForm = submitForm;
window.filterTable = filterTable;
window.filterKanban = filterKanban;
window.toggleDeleteMode = toggleDeleteMode;
window.toggleSelection = toggleSelection;
window.deleteSelected = deleteSelected;
window.openDateFilter = openDateFilter;
window.closeDateFilter = closeDateFilter;
window.applyDateFilter = applyDateFilter;
window.clearDateFilter = clearDateFilter;
window.viewRecord = viewRecord;
window.convertToCliente = convertToCliente;
window.makeEditable = makeEditable;
window.deleteRecord = deleteRecord;
window.refreshData = refreshData;
window.currentSection = currentSection;
window.deleteMode = isDeleteMode;
