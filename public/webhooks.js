// ═══════════════════════════════════════════════════════════════════
// LUMARK ERP — WEBHOOK ENGINE v1.0
// Motor central de webhooks para integración con n8n
// Endpoints: CITAS, TAREAS, PROYECTOS, PROSPECTOS
// ═══════════════════════════════════════════════════════════════════

const WEBHOOK_ENDPOINTS = {
  citas: 'https://demian405-n8n-free.hf.space/webhook/5649c541-fd91-4f8b-ba90-5da4cd767b96',
  tareas: 'https://demian405-n8n-free.hf.space/webhook/TAREAS',
  proyectos: 'https://demian405-n8n-free.hf.space/webhook/PROYECTOS',
  prospectos: 'https://demian405-n8n-free.hf.space/webhook/PROSPECTOS',
};

// Mapeo de endpoint interno → nombre del módulo semántico
const MODULE_NAMES = {
  citas: 'citas',
  tareas: 'tareas',
  proyectos: 'proyectos',
  pipeline: 'proyectos',
  pipeline_de_proyecto: 'proyectos',
  prospectos: 'prospectos',
};

// Convención de nombres de eventos
// {module}.created | {module}.updated | {module}.manual_submit
const EVENT_TYPES = {
  create: (m) => `${m}.created`,
  update: (m) => `${m}.updated`,
  button: (m) => `${m}.manual_submit`,
};

// Cola de reintentos en memoria
const webhookRetryQueue = [];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Genera un ID de evento único tipo evt_xxxxxxxx
 */
function generateEventId() {
  const rand = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return `evt_${ts}${rand}`;
}

/**
 * Construye el payload base estándar para todos los webhooks
 * @param {string} module       - citas | tareas | proyectos | prospectos
 * @param {string} triggerSource - create | update | button
 * @param {string|null} recordId
 * @param {object} data          - datos del registro
 * @param {object|null} formData - datos del formulario manual (botones)
 * @param {string|null} buttonActionId
 */
function buildPayload(module, triggerSource, recordId, data, formData = null, buttonActionId = null) {
  const eventType = EVENT_TYPES[triggerSource]?.(module) || `${module}.${triggerSource}`;

  return {
    event_id: generateEventId(),
    schema_version: '1.0',
    module: module,
    event_type: eventType,
    trigger_source: triggerSource,
    record_id: recordId || null,
    button_action_id: buttonActionId || null,
    sent_at: new Date().toISOString(),
    data: data || {},
    form_data: formData || null,
  };
}

/**
 * Envía el payload al webhook correspondiente
 * @param {string} module
 * @param {object} payload
 * @param {number} attempt - número de intento (para reintentos)
 */
async function sendWebhook(module, payload, attempt = 1) {
  const url = WEBHOOK_ENDPOINTS[module];
  if (!url) {
    console.warn(`[WEBHOOK] No hay endpoint configurado para el módulo: ${module}`);
    return;
  }

  try {
    const res = await fetch('/api/webhook-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, payload }),
    });

    if (res.ok) {
      console.log(`[WEBHOOK ✅] ${payload.event_type} → ${url} (intento ${attempt})`);
      console.log(`[WEBHOOK]   event_id: ${payload.event_id} | record_id: ${payload.record_id}`);
    } else {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
  } catch (err) {
    console.error(`[WEBHOOK ❌] ${payload.event_type} → Intento ${attempt}/${MAX_RETRIES}: ${err.message}`);
    if (attempt < MAX_RETRIES) {
      console.log(`[WEBHOOK ↩] Reintentando en ${RETRY_DELAY_MS}ms...`);
      setTimeout(() => sendWebhook(module, payload, attempt + 1), RETRY_DELAY_MS * attempt);
    } else {
      console.error(`[WEBHOOK 🚫] Máximo de reintentos alcanzado. Payload guardado en cola local.`);
      webhookRetryQueue.push({ module, payload, failedAt: new Date().toISOString() });
    }
  }
}

/**
 * Función principal pública. Construye y despacha el webhook.
 *
 * @param {string} endpointOrModule  - endpoint interno (citas, prospectos, etc.)
 * @param {string} triggerSource     - 'create' | 'update' | 'button'
 * @param {string|null} recordId     - ID del registro
 * @param {object} recordData        - datos del registro
 * @param {object|null} buttonInfo   - { formData, buttonActionId } para acciones de botón
 */
function dispatchWebhook(endpointOrModule, triggerSource, recordId, recordData, buttonInfo = null) {
  const module = MODULE_NAMES[endpointOrModule] || endpointOrModule;
  const url = WEBHOOK_ENDPOINTS[module];
  if (!url) return; // Silently skip non-webhook modules (clientes, actividades, etc.)

  const payload = buildPayload(
    module,
    triggerSource,
    recordId,
    recordData,
    buttonInfo?.formData || null,
    buttonInfo?.buttonActionId || null
  );

  // Fire & forget — no bloquea la UI
  sendWebhook(module, payload);
}

// ── BOTÓN CAMPAÑA — PROSPECTOS ────────────────────────────────────
/**
 * Abre el modal de campaña de prospectos con los seleccionados actuales
 */
function openCampanaModal() {
  const todos = window.prospectosData || [];
  if (todos.length === 0) {
    showToast('<i class="ph-fill ph-warning" style="color:#f59e0b; vertical-align:middle; margin-right:4px;"></i> No hay prospectos cargados', true);
    return;
  }

  // Renderizar TODOS los prospectos como checkboxes seleccionables en el modal
  const listHtml = todos.map(p =>
    `<li class="campana-prospect-item">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px 8px;border-radius:6px;transition:background .15s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background=''">
        <input type="checkbox" class="campana-check" value="${p['ID Prospectos'] || ''}"
          style="width:16px;height:16px;accent-color:#7c3aed;cursor:pointer;">
        <span class="badge badge-purple" style="font-size:11px;">${p['ID Prospectos'] || '?'}</span>
        <strong style="font-size:13px;">${p['Nombre del Contacto'] || '—'}</strong>
        <span style="font-size:12px;color:#9ca3af;margin-left:auto;">${p['Teléfono'] || ''}</span>
      </label>
    </li>`
  ).join('');

  document.getElementById('campanaSelectedList').innerHTML = listHtml;
  document.getElementById('campanaCount').textContent = `${todos.length} prospectos disponibles`;

  // Update count label as checkboxes change
  setTimeout(() => {
    document.querySelectorAll('.campana-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = document.querySelectorAll('.campana-check:checked').length;
        document.getElementById('campanaCount').textContent =
          checked > 0
            ? `${checked} prospecto${checked > 1 ? 's' : ''} seleccionado${checked > 1 ? 's' : ''}`
            : `${todos.length} prospectos disponibles`;
      });
    });
  }, 50);

  document.getElementById('campanaModal').classList.remove('hidden');
}

function closeCampanaModal() {
  document.getElementById('campanaModal').classList.add('hidden');
  document.getElementById('campanaForm').reset();
}

async function submitCampana(e) {
  e.preventDefault();
  const copyText = document.getElementById('campana-copy').value.trim();
  const promoType = document.getElementById('campana-promo').value;

  // Leer prospectos marcados dentro del modal
  const checkedIds = Array.from(document.querySelectorAll('.campana-check:checked')).map(cb => cb.value);
  const selectedData = (window.prospectosData || []).filter(p => checkedIds.includes(p['ID Prospectos']));

  if (!copyText) { showToast('<i class="ph-fill ph-warning" style="color:#f59e0b; vertical-align:middle; margin-right:4px;"></i> Escribe el copy antes de enviar', true); return; }
  if (!promoType) { showToast('<i class="ph-fill ph-warning" style="color:#f59e0b; vertical-align:middle; margin-right:4px;"></i> Selecciona una promoción', true); return; }
  if (!selectedData.length) { showToast('<i class="ph-fill ph-warning" style="color:#f59e0b; vertical-align:middle; margin-right:4px;"></i> Selecciona al menos un prospecto', true); return; }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const recordData = {
    selected_count: selectedData.length,
    selected_prospects: selectedData.map(p => ({
      id: p['ID Prospectos'],
      nombre: p['Nombre del Contacto'],
      telefono: p['Teléfono'],
      correo: p['Correo Electrónico'],
      asesor: p['Asesor'],
      notas: p['Notas'],
    })),
  };

  const formData = {
    copy_text: copyText,
    promotion_type: promoType,
  };

  const payload = buildPayload(
    'prospectos',
    'button',
    null,
    recordData,
    formData,
    'btn_prospecto_campana'
  );

  try {
    await sendWebhook('prospectos', payload);
    showToast(`<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i> Campaña enviada a ${selectedData.length} prospecto(s)`);
    closeCampanaModal();
  } catch (err) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; vertical-align:middle; margin-right:4px;"></i> Error al enviar campaña', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar Campaña';
  }
}

// ── BOTÓN REPORTE — PROYECTOS ─────────────────────────────────────
/**
 * Abre el modal de reporte de status de proyecto
 * @param {string} projectId - ID del proyecto (opcional, si se llama desde detalle)
 */
function openReporteModal(projectId = null) {
  // Poblar select de proyectos
  const proyectos = window.proyectosData || [];
  const select = document.getElementById('reporte-proyecto');
  select.innerHTML = '<option value="">Selecciona un proyecto...</option>' +
    proyectos.map(p =>
      `<option value="${p['ID Proyectos']}" ${p['ID Proyectos'] === projectId ? 'selected' : ''}>
        ${p['ID Proyectos']} — ${p['Nombre del Proyecto'] || '—'}
      </option>`
    ).join('');

  // Si hay proyecto preseleccionado, auto-fill el preview
  if (projectId) updateReportePreview(projectId);

  document.getElementById('reporteModal').classList.remove('hidden');
}

function closeReporteModal() {
  document.getElementById('reporteModal').classList.add('hidden');
  document.getElementById('reporteForm').reset();
  document.getElementById('reportePreview').innerHTML = '';
}

function updateReportePreview(projectId) {
  const p = (window.proyectosData || []).find(x => x['ID Proyectos'] === projectId);
  if (!p) { document.getElementById('reportePreview').innerHTML = ''; return; }

  const avance = p['% Avance'] || '0%';
  const estado = p['Estado del Proyecto'] || '—';
  const etapa = typeof formatEtapa !== 'undefined' ? formatEtapa(p['Etapa actual']) : (window.formatEtapa ? window.formatEtapa(p['Etapa actual']) : p['Etapa actual']);

  document.getElementById('reportePreview').innerHTML = `
    <div class="reporte-preview-card">
      <div class="reporte-preview-row"><span>📁 Proyecto</span><strong>${p['Nombre del Proyecto'] || '—'}</strong></div>
      <div class="reporte-preview-row"><span><i class="ph-fill ph-trend-up"></i> Avance</span><strong style="color:#10b981">${avance}</strong></div>
      <div class="reporte-preview-row"><span><i class="ph-bold ph-arrows-left-right"></i> Etapa</span><span>${etapa || '—'}</span></div>
      <div class="reporte-preview-row"><span><i class="ph-fill ph-calendar-blank"></i> Próx. Reunión</span><span>${p['Próxima reunión'] || '—'}</span></div>
    </div>`;
}

async function submitReporte(e) {
  e.preventDefault();
  const projectId = document.getElementById('reporte-proyecto').value;
  const note = document.getElementById('reporte-nota').value.trim();

  if (!projectId) { showToast('<i class="ph-fill ph-warning" style="color:#f59e0b; vertical-align:middle; margin-right:4px;"></i> Selecciona un proyecto', true); return; }
  if (!note) { showToast('<i class="ph-fill ph-warning" style="color:#f59e0b; vertical-align:middle; margin-right:4px;"></i> Escribe una nota antes de enviar', true); return; }

  const p = (window.proyectosData || []).find(x => x['ID Proyectos'] === projectId);

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const avancePct = p?.['% Avance'] || '0%';
  const estadoActual = p?.['Estado del Proyecto'] || '—';
  const servicio = p?.['Servicio'] || '—';
  const etapa = p?.['Etapa actual'] || '—';
  const etapaLabel = window.ETAPAS_MAP?.[String(etapa)] || etapa;

  // ── Payload enfocado al cliente ──────────────────────────────────
  // Solo se envía lo que es relevante para el cliente:
  // status, tipo de servicio, % avance y notas del ejecutivo
  const recordData = {
    project_id: projectId,
    project_name: p?.['Nombre del Proyecto'] || '—',
    current_status: estadoActual,
    service: servicio,
    stage: etapaLabel,
    progress_percentage: avancePct,
  };

  const formData = {
    notes: note,
    report_summary: `[${estadoActual}] ${servicio} — Avance: ${avancePct} (${etapaLabel}). ${note}`,
  };
  // ────────────────────────────────────────────────────────────────

  const payload = buildPayload(
    'proyectos',
    'button',
    projectId,
    recordData,
    formData,
    'btn_proyecto_reporte_status'
  );

  try {
    await sendWebhook('proyectos', payload);
    showToast('<i class="ph-fill ph-check-circle" style="color:#10b981; vertical-align:middle; margin-right:4px;"></i> Reporte de status enviado correctamente');
    closeReporteModal();
  } catch (err) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444; vertical-align:middle; margin-right:4px;"></i> Error al enviar reporte', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar Reporte';
  }
}

// ── EXPORT GLOBAL ─────────────────────────────────────────────────
window.dispatchWebhook = dispatchWebhook;
window.openCampanaModal = openCampanaModal;
window.closeCampanaModal = closeCampanaModal;
window.submitCampana = submitCampana;
window.openReporteModal = openReporteModal;
window.closeReporteModal = closeReporteModal;
window.updateReportePreview = updateReportePreview;
window.submitReporte = submitReporte;
window.webhookRetryQueue = webhookRetryQueue;

console.log('[WEBHOOK ENGINE] Lumark ERP Webhook Engine v1.0 — Listo ✅');
