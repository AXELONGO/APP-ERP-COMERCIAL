const crudRoutes = require('../routes/crudFactory');

function registerModules(router) {
  crudRoutes(router, 'Clientes', 'A:O', (d, e = []) => [
    e[0] || '', // ID Clientes (A)
    d.nombre !== undefined ? d.nombre : (e[1] || ''), // Nombre del Cliente (B)
    d.correo !== undefined ? d.correo : (e[2] || ''), // Correo Electrónico (C)
    d.telefono !== undefined ? d.telefono : (e[3] || ''), // Teléfono Principal (D)
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[4] || new Date().toISOString().split('T')[0]), // Fecha de Registro (E)
    d.empresa !== undefined ? d.empresa : (e[5] || ''), // Empresa o Razón Social (F)
    d.direccion !== undefined ? d.direccion : (e[6] || ''), // Dirección (G)
    d.notas !== undefined ? d.notas : (e[7] || ''), // Notas (H)
    d.estado !== undefined ? d.estado : (e[8] || 'Activo'), // Estado (I)
    d.servicios !== undefined ? d.servicios : (e[9] || ''), // Servicios (J)
    d.renovacion !== undefined ? d.renovacion : (e[10] || ''), // Renovación (K)
    d.valorMensual !== undefined ? d.valorMensual : (e[11] || ''), // Valor mensual (L)
    d.prioridad !== undefined ? d.prioridad : (e[12] || 'Media'), // Prioridad (M)
    d.estatus !== undefined ? d.estatus : (e[13] || 'Al día'), // Estatus (N)
    d.giro !== undefined ? d.giro : (e[14] || '') // Giro (O)
  ], 'clientes');

  crudRoutes(router, 'Prospectos', 'A:O', (d, e = []) => [
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
    d.nombreNegocio !== undefined ? d.nombreNegocio : (e[12] || ''),
    d.giro !== undefined ? d.giro : (e[13] || ''),
    d.etapa !== undefined ? d.etapa : (e[14] || 'Nuevo')
  ], 'prospectos');

  crudRoutes(router, 'Proyectos', 'A:M', (d, e = [], f = [], rowNum) => [
    e[0] || '', // ID Proyectos (A)
    d.nombre !== undefined ? d.nombre : (e[1] || ''), // Nombre del Proyecto (B)
    d.idCliente !== undefined ? d.idCliente : (e[2] || ''), // Cliente Relacionado (C)
    d.estado !== undefined ? d.estado : (e[3] || 'Activo'), // Estado del Proyecto (D)
    d.notas !== undefined ? d.notas : (e[4] || ''), // Notas (E)
    d.servicio !== undefined ? d.servicio : (e[5] || ''), // Servicio (F)
    d.etapa !== undefined ? d.etapa : (e[6] || '1'), // Etapa actual (G)
    `=SI(G${rowNum || 2}="","",G${rowNum || 2}*14.285714286%)`, // % Avance (H)
    e[8] || '', // Próxima reunión (I)
    e[9] || '', // Días sin movimiento (J)
    d.prioridad !== undefined ? d.prioridad : (e[10] || 'Media'), // Prioridad (K)
    d.riesgo !== undefined ? d.riesgo : (e[11] || 'Bajo'), // Riesgo (L)
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[12] || new Date().toISOString().split('T')[0]) // Fecha de Registro (M)
  ], 'proyectos');

  crudRoutes(router, 'Pipeline de Proyecto', 'A:K', (d, e = []) => [
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
  ], 'pipeline_de_proyecto');

  crudRoutes(router, 'Tareas', 'A:M', (d, e = []) => [
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
  ], 'tareas');

  crudRoutes(router, 'Citas', 'A:N', (d, e = []) => [
    e[0] || '', // ID Citas (0)
    d.nombre !== undefined ? d.nombre : (e[1] || ''), // Nombre (1)
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[2] || new Date().toISOString().split('T')[0]), // Fecha de Registro (2)
    d.correo !== undefined ? d.correo : (e[3] || ''), // Correo (3)
    d.telefono !== undefined ? d.telefono : (e[4] || ''), // Teléfono (4)
    d.fecha !== undefined ? d.fecha : (e[5] || ''), // Fecha de la Cita (5)
    d.hora !== undefined ? d.hora : (e[6] || ''), // Hora de la Cita (6)
    d.notas !== undefined ? d.notas : (e[7] || ''), // Notas (7)
    d.idProyecto !== undefined ? d.idProyecto : (e[8] || ''), // ID Proyecto (8)
    d.idCliente !== undefined ? d.idCliente : (e[9] || ''), // ID Cliente (9)
    d.tipo !== undefined ? d.tipo : (e[10] || ''), // Tipo de reunión (10)
    d.responsable !== undefined ? d.responsable : (e[11] || ''), // Responsable (11)
    d.resultado !== undefined ? d.resultado : (e[12] || ''), // Resultado (12)
    d.proximaAccion !== undefined ? d.proximaAccion : (e[13] || '') // Próxima acción (13)
  ], 'citas');

  crudRoutes(router, 'Actividades', 'A:F', (d, e = []) => [
    e[0] || '', // ID Actividad
    d.fecha !== undefined ? d.fecha : (e[1] || new Date().toISOString().split('T')[0]), // Fecha
    d.indicador !== undefined ? d.indicador : (e[2] || ''), // Indicador
    d.cantidad !== undefined ? d.cantidad : (e[3] || '1'), // Cantidad
    d.notas !== undefined ? d.notas : (e[4] || ''), // Notas
    d.responsable !== undefined ? d.responsable : (e[5] || '') // Responsable
  ], 'actividades');

  crudRoutes(router, 'Asesores', 'A:I', (d, e = []) => [
    e[0] || '',
    d.nombre !== undefined ? d.nombre : (e[1] || ''),
    d.correo !== undefined ? d.correo : (e[2] || ''),
    d.telefono !== undefined ? d.telefono : (e[3] || ''),
    d.fechaRegistro !== undefined ? d.fechaRegistro : (e[4] || new Date().toISOString().split('T')[0]),
    d.notas !== undefined ? d.notas : (e[5] || ''),
    d.rol !== undefined ? d.rol : (e[6] || 'Asesor'),
    d.contraseña !== undefined ? d.contraseña : (e[7] || ''),
    d.estado !== undefined ? d.estado : (e[8] || 'Activo')
  ], 'asesores');
}

module.exports = registerModules;
