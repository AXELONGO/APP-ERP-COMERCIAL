// ── DATA LOADER ──────────────────────────────────────────────
// Carga datos de la API con caché en memoria y reintentos

const dataCache = {};
const PENDING_CACHE = {};

async function loadData(endpoint, options = {}) {
  const { force = false, ttl = 30000, page, pageSize } = options;
  const cacheKey = `${endpoint}${page ? `_p${page}_${pageSize}` : ''}`;

  if (!force && dataCache[cacheKey] && (Date.now() - dataCache[cacheKey].ts < ttl)) {
    return dataCache[cacheKey].data;
  }

  if (PENDING_CACHE[cacheKey]) {
    return PENDING_CACHE[cacheKey];
  }

  let url = `${API}/api/${endpoint}`;
  const params = [];
  if (page) params.push(`page=${page}`);
  if (pageSize) params.push(`pageSize=${pageSize}`);
  if (params.length) url += '?' + params.join('&');

  const promise = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      dataCache[cacheKey] = { data, ts: Date.now() };
      return data;
    } catch (err) {
      console.error(`[DataLoader] Error fetching ${endpoint}:`, err);
      throw err;
    } finally {
      delete PENDING_CACHE[cacheKey];
    }
  })();

  PENDING_CACHE[cacheKey] = promise;
  return promise;
}

function invalidateCache(endpoint) {
  const prefix = `${endpoint}`;
  Object.keys(dataCache).forEach(k => {
    if (k.startsWith(prefix)) delete dataCache[k];
  });
}

async function loadAllModules() {
  const results = await Promise.allSettled([
    loadData('clientes').then(d => { window.clientesData = Array.isArray(d) ? d : d?.data || []; }),
    loadData('proyectos').then(d => { window.proyectosData = Array.isArray(d) ? d : d?.data || []; }),
    loadData('pipeline_de_proyecto').then(d => { window.pipelineData = Array.isArray(d) ? d : d?.data || []; }),
    loadData('tareas').then(d => { window.tareasData = Array.isArray(d) ? d : d?.data || []; }),
    loadData('citas').then(d => { window.citasData = Array.isArray(d) ? d : d?.data || []; }),
    loadData('asesores').then(d => { window.asesoresData = Array.isArray(d) ? d : d?.data || []; }),
    loadData('prospectos').then(d => { window.prospectosData = Array.isArray(d) ? d : d?.data || []; }),
    loadData('actividades').then(d => { window.actividadesData = Array.isArray(d) ? d : d?.data || []; }),
  ]);

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length) {
    console.warn(`[DataLoader] ${errors.length} módulo(s) fallaron al cargar`);
  }
  return errors.length === 0;
}

window.loadData = loadData;
window.invalidateCache = invalidateCache;
window.loadAllModules = loadAllModules;
