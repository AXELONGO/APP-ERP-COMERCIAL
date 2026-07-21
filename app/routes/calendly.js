const asyncHandler = require('../middleware/asyncHandler');
const { getSheets, getSheetId, SPREADSHEET_ID } = require('../config/sheets');

const CALENDLY_TOKEN = process.env.CALENDLY_TOKEN;
const CALENDLY_API = 'https://api.calendly.com';

async function fetchCalendly(path) {
  const res = await fetch(`${CALENDLY_API}${path}`, {
    headers: {
      Authorization: `Bearer ${CALENDLY_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly API error ${res.status}: ${text}`);
  }
  return res.json();
}

function uuidFromUri(uri) {
  const m = uri.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  return m ? m[0] : null;
}

function registerCalendlyRoutes(app) {
  if (!CALENDLY_TOKEN) {
    console.warn('[Calendly] CALENDLY_TOKEN no configurado — ruta /api/citas/from-calendly no disponible');
    return;
  }

  app.post('/api/citas/from-calendly', asyncHandler(async (req, res) => {
    const { eventUri } = req.body;
    if (!eventUri) return res.status(400).json({ success: false, error: 'eventUri requerido' });

    const uuid = uuidFromUri(eventUri);
    if (!uuid) return res.status(400).json({ success: false, error: 'UUID no encontrado en eventUri' });

    // Fetch event details
    let eventData, inviteesData;
    try {
      [eventData, inviteesData] = await Promise.all([
        fetchCalendly(`/scheduled_events/${uuid}`),
        fetchCalendly(`/scheduled_events/${uuid}/invitees`),
      ]);
    } catch (err) {
      return res.status(502).json({ success: false, error: err.message });
    }

    const event = eventData.resource || {};
    const invitees = inviteesData.collection || [];
    const invitee = invitees[0] || {};

    const name = invitee.name || event.name || 'Cita Calendly';
    const email = invitee.email || '';
    const startTime = event.start_time || '';
    let dateStr = '';
    let timeStr = '';
    if (startTime) {
      const dt = new Date(startTime);
      if (!isNaN(dt)) {
        dateStr = dt.toISOString().split('T')[0];
        const hh = String(dt.getHours()).padStart(2, '0');
        const mm = String(dt.getMinutes()).padStart(2, '0');
        timeStr = `${hh}:${mm}`;
      }
    }

    // Force text mode with leading apostrophe to prevent Sheets auto-converting dates to serial numbers
    const fechaReg = new Date().toISOString().split('T')[0];
    const fechaCita = dateStr ? `'${dateStr}` : '';
    const horaCita = timeStr ? `'${timeStr}` : '';

    const questions = (invitee.questions_and_answers || [])
      .map(q => `${q.question}: ${q.answer}`).join('; ');

    const notes = [
      '📅 Agendado vía Calendly',
      `Invitado: ${name} <${email}>`,
      questions ? `Notas: ${questions}` : '',
    ].filter(Boolean).join('\n');

    // Generate next ID
    const sheets = await getSheets();
    const prefix = 'CIT-';
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Citas'!A2:A",
    });
    const existingData = getRes.data.values || [];
    const maxNum = existingData.reduce((max, row) => {
      const m = row[0] ? row[0].match(/\d+/) : null;
      return m ? Math.max(max, parseInt(m[0], 10)) : max;
    }, 0);
    const nextId = `${prefix}${(maxNum + 1).toString().padStart(3, '0')}`;

    const row = [
      nextId,
      name,
      fechaReg,
      email,
      '', // teléfono
      fechaCita, // fecha de la cita
      horaCita, // hora
      notes,
      '', '', // idProyecto, idCliente
      'Cita Calendly', // tipo
      '', // responsable
      '', // resultado
      '', // proximaAccion
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Citas'!A:A",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    res.json({ success: true, id: nextId, nombre: name });
  }));
}

module.exports = { registerCalendlyRoutes };
