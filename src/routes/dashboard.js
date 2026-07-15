const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheetsService');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const [clientes, proyectos, tareas, pipeline, prospectos, citas] = await Promise.all([
    sheetsService.getPublicData('Clientes'),
    sheetsService.getPublicData('Proyectos'),
    sheetsService.getPublicData('Tareas'),
    sheetsService.getPublicData('Pipeline de Proyecto'),
    sheetsService.getPublicData('Prospectos'),
    sheetsService.getPublicData('Citas')
  ]);

  const cArr = Array.isArray(clientes) ? clientes : [];
  const pArr = Array.isArray(proyectos) ? proyectos : [];
  const tArr = Array.isArray(tareas) ? tareas : [];
  const plArr = Array.isArray(pipeline) ? pipeline : [];
  const prArr = Array.isArray(prospectos) ? prospectos : [];
  const ciArr = Array.isArray(citas) ? citas : [];

  const clientesActivos = cArr.filter(c => c['Estado'] === 'Activo').length;
  const proyectosActivos = pArr.filter(p => p['Estado del Proyecto'] === 'Activo').length;
  const proyectosReunion = pArr.filter(p => p['Estado del Proyecto'] === 'Reunión').length;
  const tareasPendientes = tArr.filter(t => t['Estado'] === 'Pendiente').length;
  const tareasEnProceso = tArr.filter(t => t['Estado'] === 'En Proceso').length;
  const ingresosMensuales = cArr.reduce((s, c) => s + (parseFloat(c['Valor mensual']) || 0), 0);

  const avancePorProyecto = {};
  plArr.forEach(p => {
    const pid = p['ID Proyecto'];
    if (!pid) return;
    if (!avancePorProyecto[pid]) avancePorProyecto[pid] = 0;
    if (p['Estado'] === 'Completado') avancePorProyecto[pid]++;
  });
  const avances = Object.values(avancePorProyecto).map(n => (n / 6) * 100);
  const avancePromedio = avances.length ? Math.round(avances.reduce((a, b) => a + b, 0) / avances.length) : 0;

  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const ingresosPorMes = {};
  cArr.forEach(c => {
    const d = new Date(c['Fecha de Registro']);
    if (isNaN(d)) return;
    const m = meses[d.getMonth()];
    ingresosPorMes[m] = (ingresosPorMes[m] || 0) + (parseFloat(c['Valor mensual']) || 0);
  });

  const serviciosDict = {};
  cArr.forEach(c => {
    const s = c['Servicios'] || 'Otros';
    serviciosDict[s] = (serviciosDict[s] || 0) + 1;
  });

  const conversionRate = prArr.length > 0 ? Math.round((cArr.length / prArr.length) * 100) : 0;

  const funnel = {
    'Nuevo': 0, 'Contactado': 0, 'Reunión Agendada': 0, 'Propuesta Enviada': 0,
    'Negociación': 0, 'Ganado': 0, 'Perdido': 0
  };
  prArr.forEach(p => {
    const e = p['Etapa'] || 'Nuevo';
    if (funnel[e] !== undefined) funnel[e]++;
  });

  const hoy = new Date().toISOString().split('T')[0];
  const proximasCitas = ciArr.filter(c => {
    const fechaCita = c['Fecha de la Cita'] || c['Fecha'];
    if (!fechaCita) return false;
    let isoFecha = fechaCita;
    if (fechaCita.includes('/')) {
      const parts = fechaCita.split('/');
      if (parts.length === 3) isoFecha = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    return isoFecha >= hoy;
  }).sort((a,b) => {
    const fA = a['Fecha de la Cita'] || a['Fecha'];
    const fB = b['Fecha de la Cita'] || b['Fecha'];
    return fA.localeCompare(fB);
  }).slice(0, 5);

  res.json({
    kpis: {
      clientesActivos, proyectosActivos, tareasPendientes,
      ingresosMensuales, avancePromedio,
      tareasEnProceso, proyectosReunion,
      prospectosTotales: prArr.length,
      conversionRate
    },
    charts: {
      ingresosMensuales: Object.keys(ingresosPorMes).map(k => ({ mes: k, valor: ingresosPorMes[k] })),
      distribucionServicios: Object.keys(serviciosDict).map(k => ({ servicio: k, cantidad: serviciosDict[k] })),
      prospectosFunnel: Object.keys(funnel).map(k => ({ etapa: k, cantidad: funnel[k] }))
    },
    proximasCitas: proximasCitas.map(c => ({
      id: c['ID Citas'],
      nombre: c['Nombre'] || c['Nombre/Tema'],
      fecha: c['Fecha de la Cita'] || c['Fecha'],
      hora: c['Hora de la Cita'] || c['Hora'],
      tipo: c['Tipo de reunión'] || c['Tipo']
    }))
  });
}));

module.exports = router;
