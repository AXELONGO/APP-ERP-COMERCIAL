const { crudRoutes } = require('./crud');

function registerModules(app) {

  crudRoutes(app, 'Clientes', 'A:O', (d, e = []) => [
    e[0] || '',
    d.nombre !== undefined ? d.nombre : (e[1] || ''),
    d.correo !== undefined ? d.correo : (e[2] || ''),
    d.telefono !== undefined ? d.telefono : (e[3] || ''),
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[4] || new Date().toISOString().split('T')[0]),
    d.empresa !== undefined ? d.empresa : (e[5] || ''),
    d.direccion !== undefined ? d.direccion : (e[6] || ''),
    d.notas !== undefined ? d.notas : (e[7] || ''),
    d.estado !== undefined ? d.estado : (e[8] || 'Activo'),
    d.servicios !== undefined ? d.servicios : (e[9] || ''),
    d.renovacion !== undefined ? d.renovacion : (e[10] || ''),
    d.valorMensual !== undefined ? d.valorMensual : (e[11] || ''),
    d.prioridad !== undefined ? d.prioridad : (e[12] || 'Media'),
    d.estatus !== undefined ? d.estatus : (e[13] || 'Al d\u00eda'),
    d.giro !== undefined ? d.giro : (e[14] || '')
  ]);

  crudRoutes(app, 'Prospectos', 'A:O', (d, e = []) => [
    e[0] || '',
    d.nombre !== undefined ? d.nombre : (e[1] || ''),
    d.correo !== undefined ? d.correo : (e[2] || ''),
    d.telefono !== undefined ? d.telefono : (e[3] || ''),
    d.notas !== undefined ? d.notas : (e[4] || ''),
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[5] || new Date().toISOString().split('T')[0]),
    d.asesor !== undefined ? d.asesor : (e[6] || ''),
    d.medioDeContacto !== undefined ? d.medioDeContacto : (e[7] || ''),
    d.situacion !== undefined ? d.situacion : (e[8] || ''),
    d.problema !== undefined ? d.problema : (e[9] || ''),
    d.implicacion !== undefined ? d.implicacion : (e[10] || ''),
    d.necesidad !== undefined ? d.necesidad : (e[11] || ''),
    e[12] || '',
    e[13] || '',
    d.etapa !== undefined ? d.etapa : (e[14] || 'Nuevo')
  ]);

  crudRoutes(app, 'Proyectos', 'A:M', (d, e = [], f = [], rowNum) => [
    e[0] || '',
    d.nombre !== undefined ? d.nombre : (e[1] || ''),
    d.idCliente !== undefined ? d.idCliente : (e[2] || ''),
    d.estado !== undefined ? d.estado : (e[3] || 'Activo'),
    d.notas !== undefined ? d.notas : (e[4] || ''),
    d.servicio !== undefined ? d.servicio : (e[5] || ''),
    d.etapa !== undefined ? d.etapa : (e[6] || '1'),
    `=SI(G${rowNum || 2}="","",G${rowNum || 2}*14.285714286%)`,
    e[8] || '',
    e[9] || '',
    d.prioridad !== undefined ? d.prioridad : (e[10] || 'Media'),
    d.riesgo !== undefined ? d.riesgo : (e[11] || 'Bajo'),
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[12] || new Date().toISOString().split('T')[0])
  ]);

  crudRoutes(app, 'Pipeline de Proyecto', 'A:K', (d, e = []) => [
    e[0] || '',
    d.idProyecto !== undefined ? d.idProyecto : (e[1] || ''),
    d.idCliente !== undefined ? d.idCliente : (e[2] || ''),
    d.etapa !== undefined ? d.etapa : (e[3] || ''),
    d.responsable !== undefined ? d.responsable : (e[4] || ''),
    d.fechaInicio !== undefined ? d.fechaInicio : (e[5] || ''),
    d.fechaFin !== undefined ? d.fechaFin : (e[6] || ''),
    e[7] || '',
    d.estado !== undefined ? d.estado : (e[8] || 'En Proceso'),
    d.comentarios !== undefined ? d.comentarios : (e[9] || ''),
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[10] || new Date().toISOString().split('T')[0])
  ]);

  crudRoutes(app, 'Tareas', 'A:M', (d, e = []) => [
    e[0] || '',
    d.idProyecto !== undefined ? d.idProyecto : (e[1] || ''),
    d.idCliente !== undefined ? d.idCliente : (e[2] || ''),
    d.categoria !== undefined ? d.categoria : (e[3] || ''),
    d.tarea !== undefined ? d.tarea : (e[4] || ''),
    d.responsable !== undefined ? d.responsable : (e[5] || ''),
    d.prioridad !== undefined ? d.prioridad : (e[6] || 'Media'),
    d.fechaInicio !== undefined ? d.fechaInicio : (e[7] || ''),
    d.fechaLimite !== undefined ? d.fechaLimite : (e[8] || ''),
    d.estado !== undefined ? d.estado : (e[9] || 'Pendiente'),
    d.evidencia !== undefined ? d.evidencia : (e[10] || ''),
    d.comentarios !== undefined ? d.comentarios : (e[11] || ''),
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[12] || new Date().toISOString().split('T')[0])
  ]);

  crudRoutes(app, 'Citas', 'A:N', (d, e = []) => [
    e[0] || '',
    d.nombre !== undefined ? d.nombre : (e[1] || ''),
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[2] || new Date().toISOString().split('T')[0]),
    d.correo !== undefined ? d.correo : (e[3] || ''),
    d.telefono !== undefined ? d.telefono : (e[4] || ''),
    d.fecha !== undefined ? d.fecha : (e[5] || ''),
    d.hora !== undefined ? d.hora : (e[6] || ''),
    d.notas !== undefined ? d.notas : (e[7] || ''),
    d.idProyecto !== undefined ? d.idProyecto : (e[8] || ''),
    d.idCliente !== undefined ? d.idCliente : (e[9] || ''),
    d.tipo !== undefined ? d.tipo : (e[10] || ''),
    d.responsable !== undefined ? d.responsable : (e[11] || ''),
    d.resultado !== undefined ? d.resultado : (e[12] || ''),
    d.proximaAccion !== undefined ? d.proximaAccion : (e[13] || '')
  ]);

  crudRoutes(app, 'Actividades', 'A:F', (d, e = []) => [
    e[0] || '',
    d.fecha !== undefined ? d.fecha : (e[1] || new Date().toISOString().split('T')[0]),
    d.indicador !== undefined ? d.indicador : (e[2] || ''),
    d.cantidad !== undefined ? d.cantidad : (e[3] || '1'),
    d.notas !== undefined ? d.notas : (e[4] || ''),
    d.responsable !== undefined ? d.responsable : (e[5] || '')
  ], 'actividades');

  crudRoutes(app, 'Asesores', 'A:F', (d, e = []) => [
    e[0] || '',
    d.nombre !== undefined ? d.nombre : (e[1] || ''),
    d.correo !== undefined ? d.correo : (e[2] || ''),
    d.telefono !== undefined ? d.telefono : (e[3] || ''),
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[4] || new Date().toISOString().split('T')[0]),
    d.notas !== undefined ? d.notas : (e[5] || '')
  ]);

  crudRoutes(app, 'Pagos y Gastos', 'A:I', (d, e = []) => [
    e[0] || '',
    d.fecha !== undefined ? d.fecha : (e[1] || new Date().toISOString().split('T')[0]),
    d.tipo !== undefined ? d.tipo : (e[2] || 'Pago'),
    d.concepto !== undefined ? d.concepto : (e[3] || ''),
    d.monto !== undefined ? String(d.monto) : (e[4] || ''),
    d.metodo !== undefined ? d.metodo : (e[5] || ''),
    d.clienteProveedor !== undefined ? d.clienteProveedor : (e[6] || ''),
    d.responsable !== undefined ? d.responsable : (e[7] || ''),
    d.notas !== undefined ? d.notas : (e[8] || '')
  ]);
}

module.exports = { registerModules };