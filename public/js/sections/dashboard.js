// ── DASHBOARD ────────────────────────────────────────────────

async function loadDashboard() {
  try {
    await loadAllModules();

    const clientes = Array.isArray(window.clientesData) ? window.clientesData : [];
    const proyectos = Array.isArray(window.proyectosData) ? window.proyectosData : [];
    const citas = Array.isArray(window.citasData) ? window.citasData : [];
    const prospectos = Array.isArray(window.prospectosData) ? window.prospectosData : [];
    const tareas = Array.isArray(window.tareasData) ? window.tareasData : [];
    const actividades = Array.isArray(window.actividadesData) ? window.actividadesData : [];

    // 1. COMERCIAL
    const nuevosProspectos = prospectos.filter(p => {
      const f = p['Fecha de Registro'] || '';
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      return f >= monthStart;
    }).length;
    if (document.getElementById('kpiNuevosProspectos')) document.getElementById('kpiNuevosProspectos').textContent = nuevosProspectos;

    const citasTotales = citas.length;
    if (document.getElementById('kpiCitas')) document.getElementById('kpiCitas').textContent = citasTotales;

    const citasExitosas = citas.filter(c => (c['Resultado'] || '').toLowerCase().includes('exitos')).length;
    const showRate = citasTotales > 0 ? Math.round((citasExitosas / citasTotales) * 100) : 0;
    if (document.getElementById('kpiShowRate')) document.getElementById('kpiShowRate').textContent = showRate + '%';

    const asesores = Array.isArray(window.asesoresData) ? window.asesoresData : [];
    const prospectosAsesor = {};
    prospectos.forEach(p => {
      const a = p['Asesor'] || 'Sin Asignar';
      prospectosAsesor[a] = (prospectosAsesor[a] || 0) + 1;
    });
    renderBarChart('chartProspectosAsesor', prospectosAsesor, 'Prospectos', '#8b5cf6');

    const citasResponsable = {};
    citas.forEach(c => {
      const r = c['Responsable'] || 'Sin Asignar';
      citasResponsable[r] = (citasResponsable[r] || 0) + 1;
    });
    renderBarChart('chartCitasResponsable', citasResponsable, 'Citas', '#06b6d4');

    // 2. FINANCIERO
    let mrr = 0;
    let renovaciones = 0;
    clientes.forEach(c => {
      mrr += parseFloat(c['Valor mensual']) || 0;
      if (c['Renovación']) {
        const d = new Date(c['Renovación']);
        const hoy = new Date();
        const diff = (d - hoy) / (1000 * 60 * 60 * 24);
        if (diff >= 0 && diff <= 30) renovaciones++;
      }
    });
    if (document.getElementById('kpiMRR')) document.getElementById('kpiMRR').textContent = '$' + mrr.toLocaleString();
    if (document.getElementById('kpiRenovaciones')) document.getElementById('kpiRenovaciones').textContent = renovaciones;
    if (document.getElementById('kpiTotalClientes')) document.getElementById('kpiTotalClientes').textContent = clientes.length;

    // 3. OPERACIÓN
    let sumAvance = 0, validAvance = 0;
    let sumDiasMov = 0, validDias = 0;
    let proyectosRiesgo = 0;
    proyectos.forEach(p => {
      const avance = parseFloat(p['% Avance']);
      if (!isNaN(avance)) { sumAvance += avance; validAvance++; }
      const diasStr = p['Días sin movimiento'];
      if (diasStr && !isNaN(parseInt(diasStr))) {
        sumDiasMov += parseInt(diasStr);
        validDias++;
      }
      if (p['Riesgo'] === 'Alto') proyectosRiesgo++;
    });
    if (document.getElementById('kpiAvancePromedio')) document.getElementById('kpiAvancePromedio').textContent =
      validAvance > 0 ? Math.round(sumAvance / validAvance) + '%' : '0%';
    if (document.getElementById('kpiProyectosRiesgo')) document.getElementById('kpiProyectosRiesgo').textContent = proyectosRiesgo;
    if (document.getElementById('kpiDiasSinMovimiento')) document.getElementById('kpiDiasSinMovimiento').textContent =
      validDias > 0 ? Math.round(sumDiasMov / validDias) : '0';

    let sumTiempo = 0, countTiempo = 0;
    const pipelineEtapas = {};
    proyectos.forEach(p => {
      let rawE = p['Etapa actual'] || '1';
      let e = rawE;
      if (['1','2','3','4','5','6','7'].includes(String(rawE))) {
        e = formatEtapa(rawE).replace(/<[^>]*>?/gm, '');
        if (e.includes('→')) e = e.split('→')[1].trim();
      }
      pipelineEtapas[e] = (pipelineEtapas[e] || 0) + 1;
      const d = p['Días sin movimiento'];
      if (d && !isNaN(parseInt(d))) { sumTiempo += parseInt(d); countTiempo++; }
    });
    if (document.getElementById('kpiTiempoEtapa')) document.getElementById('kpiTiempoEtapa').textContent =
      countTiempo > 0 ? Math.round(sumTiempo / countTiempo) : '0';
    renderBarChart('chartPipelineEtapas', pipelineEtapas, 'Proyectos', '#06b6d4');

    const serviciosCount = {};
    proyectos.forEach(p => {
      const s = p['Servicio'] || p['Tipo de Servicio'];
      if (s) serviciosCount[s] = (serviciosCount[s] || 0) + 1;
    });
    renderDoughnutChart('chartServicios', serviciosCount);

    // 4. PRODUCTIVIDAD
    let tareasCompletadas = 0, tareasATiempo = 0;
    tareas.forEach(t => {
      if (t['Estado'] === 'Terminado') {
        tareasCompletadas++;
        if (t['Fecha límite'] && t['Fecha de Registro']) {
          const fLim = new Date(t['Fecha límite']);
          const fReg = new Date(t['Fecha de Registro']);
          if (!isNaN(fLim) && !isNaN(fReg) && fLim >= fReg) tareasATiempo++;
        }
      }
    });
    if (document.getElementById('kpiTareasCompletadas')) document.getElementById('kpiTareasCompletadas').textContent = tareasCompletadas;
    if (document.getElementById('kpiCumplimientoFechas')) document.getElementById('kpiCumplimientoFechas').textContent =
      tareasCompletadas > 0 ? Math.round((tareasATiempo / tareasCompletadas) * 100) + '%' : '0%';

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

  } catch (e) {
    console.error('[Dashboard] Error:', e);
  }
}

window.loadDashboard = loadDashboard;
