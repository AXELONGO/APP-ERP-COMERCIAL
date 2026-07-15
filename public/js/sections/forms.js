// ── FORM TEMPLATES ──────────────────────────────────────────

function formProspecto() {
  return `<form onsubmit="submitForm(event,'prospectos')">
    <div class="form-grid">
      <div class="form-group"><label>Nombre *</label><input name="nombre" required></div>
      <div class="form-group"><label>Correo</label><input name="correo" type="email"></div>
      <div class="form-group"><label>Teléfono</label><input name="telefono"></div>
      <div class="form-group"><label>Asesor</label>
        <select name="asesor"><option value="">Selecciona Asesor...</option>
          ${generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor')}</select></div>
      <div class="form-group"><label>Medio de Contacto</label>
        <select name="medioDeContacto">
          <option value="">Seleccionar...</option>
          <option value="Whatsapp">Whatsapp</option>
          <option value="Redes sociales">Redes sociales</option>
          <option value="Recomendación">Recomendación</option>
          <option value="Llamada">Llamada</option>
          <option value="Evento">Evento</option>
        </select></div>
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
          <option>Servicios de diagnóstico</option><option>Diseño de sistemas</option>
          <option>Automatización</option><option>Diseño web</option>
          <option>Campaña ADS</option><option>Paquete contenido</option>
          <option>Branding</option><option>Socio de crecimiento</option>
          <option>Video</option><option>Diseño gráfico</option>
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

function formProyecto() {
  return `<form onsubmit="submitForm(event,'proyectos')">
    <div class="form-grid">
      <div class="form-group full"><label>Nombre del Proyecto *</label><input name="nombre" required></div>
      <div class="form-group"><label>Cliente Relacionado *</label>
        <select name="idCliente" required>
          <option value="">Selecciona Cliente...</option>
          ${generateOptions('clientesData', 'ID Clientes', 'Nombre del Cliente')}
        </select></div>
      <div class="form-group"><label>Servicio</label>
        <select name="servicio">
          <option>Servicios de diagnóstico</option><option>Diseño de sistemas</option>
          <option>Automatización</option><option>Diseño web</option>
          <option>Campaña ADS</option><option>Paquete contenido</option>
          <option>Branding</option><option>Socio de crecimiento</option>
          <option>Video</option><option>Diseño gráfico</option>
        </select></div>
      <div class="form-group"><label>Etapa Actual</label>
        <select name="etapa">
          <option value="1">1 → Activación</option>
          <option value="2">2 → Diagnóstico</option>
          <option value="3">3 → Calendario de Contenido</option>
          <option value="4">4 → Creación de Contenido</option>
          <option value="5">5 → Campaña</option>
          <option value="6">6 → Reporte de Resultados</option>
          <option value="7">7 → Renovación</option>
        </select></div>
      <div class="form-group"><label>Estado</label>
        <select name="estado"><option>Activo</option><option>Reunión</option><option>Cerrado</option></select></div>
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
        </select></div>
      <div class="form-group"><label>Cliente</label>
        <select name="idCliente">
          <option value="">Selecciona Cliente...</option>
          ${generateOptions('clientesData', 'ID Clientes', 'Nombre del Cliente')}
        </select></div>
      <div class="form-group"><label>Etapa *</label>
        <select name="etapa" required>
          <option>Activación</option><option>Diagnóstico</option><option>Calendario de Contenido</option>
          <option>Creación de Contenido</option><option>Campaña</option><option>Reporte de Resultados</option>
        </select></div>
      <div class="form-group"><label>Responsable</label>
        <select name="responsable">
          <option value="">Selecciona Asesor...</option>
          ${generateOptions('asesoresData', 'Nombre del Asesor', 'Nombre del Asesor')}
        </select></div>
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
        </select></div>
      <div class="form-group"><label>Cliente</label>
        <select name="idCliente">
          <option value="">Selecciona Cliente...</option>
          ${generateOptions('clientesData', 'ID Clientes', 'Nombre del Cliente')}
        </select></div>
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
        </select></div>
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
        </select></div>
      <div class="form-group"><label>Cliente</label>
        <select name="idCliente">
          <option value="">Selecciona Cliente...</option>
          ${generateOptions('clientesData', 'ID Clientes', 'Nombre del Cliente')}
        </select></div>
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
        </select></div>
      <div class="form-group full"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
    </div>
    <button type="submit" class="btn btn-primary btn-block">Guardar Cita</button>
  </form>`;
}

// Exponer globalmente
window.formProspecto = formProspecto;
window.formCliente = formCliente;
window.formProyecto = formProyecto;
window.formPipeline = formPipeline;
window.formTarea = formTarea;
window.formCita = formCita;
