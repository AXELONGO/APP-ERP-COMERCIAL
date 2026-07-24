const asyncHandler = require('../middleware/asyncHandler');
const { getPublicData } = require('../config/sheets');
const { getPipeline } = require('../services/pipelineService');

function registerDashboard(app) {

  app.get('/api/dashboard', asyncHandler(async (req, res) => {
    const [clientes, proyectos, tareas, pipeline, prospectos, citas] = await Promise.all([
      getPublicData('Clientes'),
      getPublicData('Proyectos'),
      getPublicData('Tareas'),
      getPublicData('Pipeline de Proyecto'),
      getPublicData('Prospectos'),
      getPublicData('Citas')
    ]);
    const projectPipeline = await getPipeline('proyectos').catch(() => null);

    const clientesActivos = clientes.filter(c => c['Estado'] === 'Activo').length;
    const proyectosActivos = proyectos.filter(p => p['Estado del Proyecto'] === 'Activo').length;
    const proyectosReunion = proyectos.filter(p => p['Estado del Proyecto'] === 'Reuni\u00f3n').length;
    const tareasPendientes = tareas.filter(t => t['Estado'] === 'Pendiente').length;
    const tareasEnProceso = tareas.filter(t => t['Estado'] === 'En Proceso').length;
    const ingresosMensuales = clientes.reduce((s, c) => s + (parseFloat(c['Valor mensual']) || 0), 0);

    const stages = (projectPipeline?.stages || []).filter(stage => stage.active).sort((a, b) => a.order_index - b.order_index);
    const stageIndex = value => stages.findIndex(stage => [stage.legacy_value, stage.stage_key, stage.name].map(String).includes(String(value)));
    const avances = proyectos.map(project => {
      const index = stageIndex(project['Etapa actual']);
      if (index < 0) return 0;
      return stages.length <= 1 ? 100 : (index / (stages.length - 1)) * 100;
    });
    const avancePromedio = avances.length ? Math.round(avances.reduce((a, b) => a + b, 0) / avances.length) : 0;

    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const ingresosPorMes = {};
    clientes.forEach(c => {
      const d = new Date(c['Fecha de Registro']);
      if (isNaN(d)) return;
      const m = meses[d.getMonth()];
      ingresosPorMes[m] = (ingresosPorMes[m] || 0) + (parseFloat(c['Valor mensual']) || 0);
    });

    const serviciosCount = {};
    clientes.forEach(c => {
      const s = c['Servicios contratados'];
      if (s && s.length > 2 && isNaN(s) && !s.includes('@'))
        serviciosCount[s] = (serviciosCount[s] || 0) + 1;
    });

    const etapasCount = {};
    proyectos.forEach(p => {
      const e = p['Etapa actual'];
      if (e) etapasCount[e] = (etapasCount[e] || 0) + 1;
    });

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
      pipelineConfig: projectPipeline || null,
    });
  }));

  app.get('/api/tracker', asyncHandler(async (req, res) => {
    const data = await getPublicData('Tracker Semanal');
    res.json(data);
  }));
}

module.exports = { registerDashboard };
