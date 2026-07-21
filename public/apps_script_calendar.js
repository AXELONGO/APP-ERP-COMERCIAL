/**
 * ============================================================
 * LUMARKGROUP - Sistema de Agendamiento de Citas (ADAPTADO ERP)
 * ============================================================
 */

var ASESORES = [
  'lumarkgroup@gmail.com',
  'perezvromar@gmail.com',
  'efrainhipolito333@gmail.com'
];

function doPost(e) {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    // 1. LEER LOS DATOS DEL WEBHOOK DEL ERP
    var rawBody = e.postData ? e.postData.contents : '{}';
    var payload = JSON.parse(rawBody);
    
    // El ERP envia los datos dentro del objeto "data"
    var datos = payload.data || {};

    var nombre   = (datos.nombre   || '').trim() || 'Sin nombre';
    var correo   = (datos.correo   || '').trim() || 'Sin correo';
    var telefono = (datos.telefono || '').trim() || 'Sin teléfono';
    var fecha    = (datos.fecha    || '').trim();
    var hora     = (datos.hora     || '').trim();
    var notas    = (datos.notas    || '').trim();

    // El ERP envía el asesor bajo la llave "responsable"
    var agenteRaw = (datos.responsable || '').trim();
    var agentesSeleccionados = agenteRaw.length > 0
      ? agenteRaw.split(',').map(function(a) { return a.trim(); }).filter(function(a) { return a.length > 0; })
      : [];

    // NOTA: Se omite la sección "GUARDAR EN GOOGLE SHEETS" porque 
    // el backend de Node.js (Docker) ya se encarga de guardar la fila 
    // en la hoja de cálculo. De lo contrario, se crearían citas duplicadas.

    // 2. CREAR EVENTO EN GOOGLE CALENDAR
    var errorCalendar = null;
    var fechaObjInicio = null;
    var fechaObjFin = null;
    var descripcion = '';

    if (fecha && hora) {
      try {
        fechaObjInicio = new Date(fecha + 'T' + hora + ':00');
        fechaObjFin = new Date(fechaObjInicio.getTime() + 60 * 60 * 1000); // 1 hora después

        var calendar = CalendarApp.getDefaultCalendar();
        var titulo = 'Cita LumarkGroup: ' + nombre;
        descripcion = 'DATOS DEL CLIENTE\n─────────────────\n' +
          'Nombre: ' + nombre + '\nTeléfono: ' + telefono + '\nCorreo: ' + correo + '\n\n' +
          'ASESORES\n─────────────────\n' + (agentesSeleccionados.length > 0 ? agentesSeleccionados.join('\n') : 'Ninguno') + '\n\n' +
          'NOTAS\n─────────────────\n' + (notas || 'Sin notas');

        var todosLosInvitados = [correo].concat(agentesSeleccionados).filter(function(c) {
          return c && c.indexOf('@') !== -1 && c !== 'Sin correo';
        });

        var opcionesEvento = { description: descripcion, sendInvites: true };
        if (todosLosInvitados.length > 0) {
          opcionesEvento.guests = todosLosInvitados.join(',');
        }

        calendar.createEvent(titulo, fechaObjInicio, fechaObjFin, opcionesEvento);
      } catch (calErr) {
        errorCalendar = calErr.toString();
        console.error("Error en Calendar:", errorCalendar);
      }
    }

    // 3. ENVIAR CORREO EXPLÍCITO A LOS ASESORES CON BOTÓN HTML
    var errorCorreo = null;
    try {
      if (agentesSeleccionados.length > 0 && fechaObjInicio && !isNaN(fechaObjInicio.getTime())) {
        
        var formatGCalDate = function(d) {
          return d.toISOString().replace(/-|:|\.\d+/g, '');
        };
        var gCalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
          '&text=' + encodeURIComponent('Cita LumarkGroup: ' + nombre) +
          '&dates=' + formatGCalDate(fechaObjInicio) + '/' + formatGCalDate(fechaObjFin) +
          '&details=' + encodeURIComponent(descripcion);

        var cuerpoCorreoHTML = '<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">' +
          '<h2 style="color: #965d0f; text-align: center;">¡Nueva Cita en LumarkGroup!</h2>' +
          '<p>Se ha agendado una nueva cita desde el ERP.</p>' +
          '<ul>' +
            '<li><strong>Cliente:</strong> ' + nombre + '</li>' +
            '<li><strong>Teléfono:</strong> ' + telefono + '</li>' +
            '<li><strong>Correo:</strong> ' + correo + '</li>' +
            '<li><strong>Fecha:</strong> ' + fecha + '</li>' +
            '<li><strong>Hora:</strong> ' + hora + '</li>' +
          '</ul>' +
          '<p><strong>Notas:</strong><br>' + (notas || 'Sin notas') + '</p>' +
          '<div style="text-align: center; margin: 30px 0;">' +
            '<a href="' + gCalUrl + '" style="background-color: #965d0f; color: #ffffff; padding: 14px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">' +
              '📅 Agregar a mi Google Calendar' +
            '</a>' +
          '</div>' +
          '<p style="font-size: 12px; color: #999; text-align: center;">ERP LumarkGroup</p>' +
        '</div>';

        MailApp.sendEmail({
          to: agentesSeleccionados.join(','),
          subject: 'Nueva Cita ERP: ' + nombre,
          htmlBody: cuerpoCorreoHTML
        });
      }
    } catch (mailErr) {
      errorCorreo = mailErr.toString();
      console.error("Error enviando correo:", errorCorreo);
    }

    // 4. RESPUESTA
    var respuesta = {
      status: 'success',
      message: 'Cita procesada para Calendar y Correo correctamente.',
      calendarError: errorCalendar,
      mailError: errorCorreo
    };

    return ContentService.createTextOutput(JSON.stringify(respuesta)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Servicio activo ERP.' })).setMimeType(ContentService.MimeType.JSON);
}
