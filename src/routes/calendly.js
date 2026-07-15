const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getSheets } = require('../config/sheets');
const env = require('../config/env');
const { notifyEvent } = require('../services/notificationService');

router.post('/', asyncHandler(async (req, res) => {
  const { eventUri, inviteeUri } = req.body;
  if (!eventUri || !inviteeUri) return res.status(400).json({ error: 'Missing uris' });
  
  // 1. Fetch Event Details
  const eventRes = await fetch(eventUri, { headers: { 'Authorization': `Bearer ${env.CALENDLY_TOKEN}` } });
  const eventData = await eventRes.json();
  const event = eventData.resource;
  
  // 2. Fetch Invitee Details
  const inviteeRes = await fetch(inviteeUri, { headers: { 'Authorization': `Bearer ${env.CALENDLY_TOKEN}` } });
  const inviteeData = await inviteeRes.json();
  const invitee = inviteeData.resource;
  
  if (!event) throw new Error('Event resource not found in response');
  if (!invitee) throw new Error('Invitee resource not found in response');
  
  // Extract date and time
  const startDate = new Date(event.start_time);
  const dateStr = startDate.toISOString().split('T')[0];
  const timeStr = startDate.toISOString().split('T')[1].substring(0,5);

  const sheets = await getSheets();
  
  // Generate next ID
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId: env.SPREADSHEET_ID,
    range: "'Citas'!A2:A",
  });
  const existingData = getRes.data.values || [];
  const maxNum = existingData.reduce((max, row) => {
    const m = row[0] ? row[0].match(/\d+/) : null;
    return m ? Math.max(max, parseInt(m[0], 10)) : max;
  }, 0);
  const nextId = `CIT-${(maxNum + 1).toString().padStart(3, '0')}`;

  const rowObj = {
    'ID Citas': nextId,
    'Nombre': invitee.name || '',
    'Fecha de Registro': new Date().toISOString().split('T')[0],
    'Correo': invitee.email || '',
    'Teléfono': '',
    'Fecha de la Cita': dateStr,
    'Hora de la Cita': timeStr,
    'Notas': event.name || '',
    'ID Proyecto': '',
    'ID Cliente': '',
    'Tipo': 'Calendly',
    'Responsable': '',
    'Resultado': '',
    'Próxima acción': ''
  };

  const newRow = [
    rowObj['ID Citas'],
    rowObj['Nombre'],
    rowObj['Fecha de Registro'],
    rowObj['Correo'],
    rowObj['Teléfono'],
    rowObj['Fecha de la Cita'],
    rowObj['Hora de la Cita'],
    rowObj['Notas'],
    rowObj['ID Proyecto'],
    rowObj['ID Cliente'],
    rowObj['Tipo'],
    rowObj['Responsable'],
    rowObj['Resultado'],
    rowObj['Próxima acción']
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: env.SPREADSHEET_ID,
    range: "'Citas'!A:N",
    valueInputOption: 'USER_ENTERED',
    resource: { values: [newRow] },
  });

  // Notificar integración automática de Calendly
  notifyEvent('CREATE', 'Citas', nextId, { ...rowObj, Origen: 'Calendly Auto-Sync' });

  res.json({ success: true, id: nextId, data: rowObj });
}));

module.exports = router;
