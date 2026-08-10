const { getPool } = require('../config/database');
const { requireV2Auth, requireRole } = require('../middleware/v2Auth');
const { getIntegrationConfig } = require('../services/integrationConfig');
const { sendText, getWahaConfig } = require('../services/wahaClient');
const PDFDocument = require('pdfkit');

const WRITE_ROLES = ['admin', 'supervisor', 'advisor'];
const MANAGE_ROLES = ['admin', 'supervisor'];

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function dateOnly(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) throw badRequest('items debe ser un arreglo');
  return items.map((item, index) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unit_price ?? item.unitPrice ?? 0);
    if (!item.name?.trim()) throw badRequest(`El producto ${index + 1} necesita nombre`);
    if (!Number.isFinite(quantity) || quantity < 1) throw badRequest(`La cantidad del producto ${index + 1} debe ser mayor o igual a 1`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw badRequest(`El precio del producto ${index + 1} no puede ser negativo`);
    return {
      product_id: item.product_id || null,
      name: String(item.name).trim(),
      description: item.description ? String(item.description).trim() : null,
      quantity,
      unit_price: roundMoney(unitPrice),
      currency: item.currency || 'MXN',
      position: Number.isInteger(item.position) ? item.position : index,
    };
  });
}

function calculateQuote(input = {}) {
  const items = normalizeItems(input.items || []);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));
  const discountType = input.discount_type === 'percentage' ? 'percentage' : 'fixed';
  const discountValue = Number(input.discount_value ?? 0);
  const taxRate = Number(input.tax_rate ?? 0);
  if (!Number.isFinite(discountValue) || discountValue < 0) throw badRequest('El descuento no puede ser negativo');
  if (!Number.isFinite(taxRate) || taxRate < 0) throw badRequest('El impuesto no puede ser negativo');
  if (discountType === 'percentage' && discountValue > 100) throw badRequest('El descuento porcentual no puede superar 100%');
  const discountAmount = roundMoney(discountType === 'percentage' ? subtotal * discountValue / 100 : Math.min(discountValue, subtotal));
  const base = roundMoney(subtotal - discountAmount);
  const taxAmount = roundMoney(base * taxRate / 100);
  const total = roundMoney(base + taxAmount);
  return { items, subtotal, discount_type: discountType, discount_value: roundMoney(discountValue), discount_amount: discountAmount, tax_rate: roundMoney(taxRate), tax_amount: taxAmount, total };
}

function validatePaymentPlan(plan, total, required = false) {
  const paymentPlan = plan && typeof plan === 'object' ? plan : {};
  const concepts = Array.isArray(paymentPlan.concepts) ? paymentPlan.concepts : [];
  const planTotal = roundMoney(concepts.reduce((sum, concept) => sum + Number(concept.amount || 0), 0));
  const difference = roundMoney(total - planTotal);
  const complete = concepts.length > 0 && Math.abs(difference) <= 0.01;
  if (required && !complete) throw badRequest(`El plan de pago no coincide con el total. Diferencia: $${difference.toFixed(2)}`);
  return { ...paymentPlan, concepts, calculated_total: planTotal, difference, complete };
}

function validateForSend(payload, calculated) {
  if (!payload.contact_id) throw badRequest('Selecciona un contacto antes de enviar');
  if (!calculated.items.length) throw badRequest('Agrega al menos un producto o servicio');
  if (calculated.total <= 0) throw badRequest('El total debe ser mayor que cero');
  if (!dateOnly(payload.valid_until)) throw badRequest('Configura una vigencia válida');
  if (payload.fiscal_data?.requires_invoice) {
    const fiscal = payload.fiscal_data;
    for (const field of ['rfc', 'legal_name', 'tax_address', 'postal_code', 'tax_regime', 'cfdi_use']) {
      if (!String(fiscal[field] || '').trim()) throw badRequest(`El dato fiscal ${field} es obligatorio`);
    }
  }
  if (!payload.payment_method?.type) throw badRequest('Configura la forma de cobro');
  validatePaymentPlan(payload.payment_plan, calculated.total, true);
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function quotePayload(body, calculated) {
  return {
    contact_id: body.contact_id || null,
    currency: body.currency || 'MXN',
    valid_until: dateOnly(body.valid_until),
    ...calculated,
    payment_plan: validatePaymentPlan(body.payment_plan, calculated.total),
    fiscal_data: body.fiscal_data || {},
    payment_method: body.payment_method || {},
    send_channel: body.send_channel || null,
    message: body.message || null,
  };
}

async function findQuote(client, workspaceId, id, withItems = true) {
  const quote = workspaceId
    ? await client.query(`SELECT q.*, c.name AS contact_name, c.phone_e164, c.email AS contact_email FROM quotes q LEFT JOIN contacts c ON c.id = q.contact_id WHERE q.id = $1 AND q.workspace_id = $2`, [id, workspaceId])
    : await client.query(`SELECT q.*, c.name AS contact_name, c.phone_e164, c.email AS contact_email FROM quotes q LEFT JOIN contacts c ON c.id = q.contact_id WHERE q.id = $1`, [id]);
  if (!quote.rows[0]) return null;
  const result = quote.rows[0];
  if (withItems) {
    const items = await client.query('SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY position, id', [id]);
    result.items = items.rows;
  }
  return result;
}

async function addQuoteEvent(client, workspaceId, quoteId, eventType, actorId, channel = null, metadata = {}) {
  await client.query(
    `INSERT INTO quote_events (workspace_id, quote_id, event_type, channel, actor_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`, [workspaceId, quoteId, eventType, channel, actorId, metadata]
  );
  await client.query(
    `INSERT INTO audit_events (workspace_id,event_type,entity_type,entity_id,actor_type,actor_id,after_data)
     VALUES ($1,$2,'quote',$3,'user',$4,$5)`, [workspaceId, `quote.${eventType}`, quoteId, actorId, metadata]
  );
}

async function saveQuote(client, workspaceId, userId, body, existing = null, status = 'draft') {
  const calculated = calculateQuote(body);
  const payload = quotePayload(body, calculated);
  if (existing?.locked_at || ['sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'].includes(existing?.status)) {
    throw badRequest('Esta versión de la cotización está congelada. Duplica la cotización para editarla.');
  }
  if (payload.contact_id) {
    const contact = await client.query('SELECT id FROM contacts WHERE id = $1 AND workspace_id = $2', [payload.contact_id, workspaceId]);
    if (!contact.rows[0]) throw badRequest('El contacto seleccionado no pertenece al workspace');
  }
  let quote;
  if (!existing) {
    const number = `COT-${Date.now().toString().slice(-8)}`;
    quote = await client.query(
      `INSERT INTO quotes (workspace_id,quote_number,contact_id,status,currency,valid_until,subtotal,discount_type,discount_value,discount_amount,tax_rate,tax_amount,total,payment_plan,fiscal_data,payment_method,send_channel,message,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [workspaceId, number, payload.contact_id, status, payload.currency, payload.valid_until, payload.subtotal, payload.discount_type, payload.discount_value, payload.discount_amount, payload.tax_rate, payload.tax_amount, payload.total, payload.payment_plan, payload.fiscal_data, payload.payment_method, payload.send_channel, payload.message, userId]
    );
  } else {
    quote = await client.query(
      `UPDATE quotes SET contact_id=$1,currency=$2,valid_until=$3,subtotal=$4,discount_type=$5,discount_value=$6,discount_amount=$7,tax_rate=$8,tax_amount=$9,total=$10,payment_plan=$11,fiscal_data=$12,payment_method=$13,send_channel=$14,message=$15,status=$16,updated_at=now(),version=version+1
       WHERE id=$17 AND workspace_id=$18 RETURNING id`,
      [payload.contact_id, payload.currency, payload.valid_until, payload.subtotal, payload.discount_type, payload.discount_value, payload.discount_amount, payload.tax_rate, payload.tax_amount, payload.total, payload.payment_plan, payload.fiscal_data, payload.payment_method, payload.send_channel, payload.message, status, existing.id, workspaceId]
    );
  }
  const quoteId = quote.rows[0].id;
  await client.query('DELETE FROM quote_items WHERE quote_id = $1', [quoteId]);
  for (const item of payload.items) {
    await client.query(
      `INSERT INTO quote_items (quote_id,product_id,name,description,quantity,unit_price,currency,position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [quoteId, item.product_id, item.name, item.description, item.quantity, item.unit_price, item.currency, item.position]
    );
  }
  return { id: quoteId, calculated: payload };
}

function registerQuoteRoutes(app) {
  app.get('/quote/:id', async (req, res, next) => {
    try {
      const client = getPool();
      const quote = await findQuote(client, null, req.params.id);
      if (!quote) return res.status(404).send('Cotización no encontrada');
      await client.query(`UPDATE quotes SET status=CASE WHEN status='sent' THEN 'viewed' ELSE status END,updated_at=now() WHERE id=$1`, [req.params.id]);
      if (quote.status === 'sent') await addQuoteEvent(client, quote.workspace_id, quote.id, 'viewed', null, 'link', {});
      const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
      const items = (quote.items || []).map(item => `<tr><td>${safe(item.name)}</td><td>${item.quantity}</td><td>${safe(quote.currency)} ${Number(item.unit_price).toFixed(2)}</td><td>${safe(quote.currency)} ${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td></tr>`).join('');
      return res.type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cotización ${safe(quote.quote_number)}</title><style>body{font-family:Inter,Arial,sans-serif;background:#faf9fc;color:#17151d;margin:0;padding:32px}.card{max-width:760px;margin:auto;background:#fff;border:1px solid #e8e2f0;border-radius:18px;padding:32px;box-shadow:0 15px 40px #35215d12}h1{margin:0 0 6px;color:#4f2bb8}p,small{color:#756d80}table{width:100%;border-collapse:collapse;margin:26px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #eeeaf3}th{color:#756d80;font-size:12px}.total{display:flex;justify-content:space-between;font-size:22px;font-weight:700}.pill{display:inline-block;padding:6px 10px;background:#f3efff;color:#4f2bb8;border-radius:99px;font-size:12px}</style></head><body><main class="card"><span class="pill">Cotización</span><h1>${safe(quote.quote_number)}</h1><p>Hola ${safe(quote.contact_name || 'cliente')}, esta es tu propuesta comercial.</p><table><thead><tr><th>Producto o servicio</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr></thead><tbody>${items}</tbody></table><p>Subtotal: ${safe(quote.currency)} ${Number(quote.subtotal).toFixed(2)}<br>Impuestos: ${safe(quote.currency)} ${Number(quote.tax_amount).toFixed(2)}</p><div class="total"><span>Total</span><span>${safe(quote.currency)} ${Number(quote.total).toFixed(2)}</span></div><p>Vigencia: ${safe(quote.valid_until || 'No especificada')}</p></main></body></html>`);
    } catch (error) { next(error); }
  });

  app.get('/api/v2/catalog/products', requireV2Auth, async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim();
      const result = await getPool().query(
        `SELECT * FROM catalog_products WHERE workspace_id=$1 AND available=true AND ($2='' OR name ILIKE '%'||$2||'%' OR description ILIKE '%'||$2||'%') ORDER BY name LIMIT 100`, [req.workspaceId, search]
      );
      res.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/catalog/products', requireV2Auth, requireRole(...MANAGE_ROLES), async (req, res, next) => {
    try {
      const { name, description = null, price = 0, currency = 'MXN' } = req.body || {};
      if (!name?.trim() || Number(price) < 0) return res.status(400).json({ error: 'Nombre y precio válido son obligatorios' });
      const result = await getPool().query('INSERT INTO catalog_products (workspace_id,name,description,price,currency) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.workspaceId, name.trim(), description, price, currency]);
      res.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.get('/api/v2/quotes', requireV2Auth, async (req, res, next) => {
    try {
      const result = await getPool().query(
        `SELECT q.id,q.quote_number,q.status,q.currency,q.valid_until,q.subtotal,q.total,q.updated_at,q.contact_id,c.name AS contact_name,c.phone_e164
         FROM quotes q LEFT JOIN contacts c ON c.id=q.contact_id WHERE q.workspace_id=$1 ORDER BY q.updated_at DESC LIMIT 100`, [req.workspaceId]
      );
      res.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/quotes', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const saved = await saveQuote(client, req.workspaceId, req.user.sub, req.body || {}, null, 'draft');
      await addQuoteEvent(client, req.workspaceId, saved.id, 'created', req.user.sub, null, { total: saved.calculated.total, contact_id: saved.calculated.contact_id });
      await client.query('COMMIT');
      res.status(201).json({ data: await findQuote(client, req.workspaceId, saved.id) });
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); } finally { client.release(); }
  });

  app.get('/api/v2/quotes/:id', requireV2Auth, async (req, res, next) => {
    try {
      const quote = await findQuote(getPool(), req.workspaceId, req.params.id);
      if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
      res.json({ data: quote });
    } catch (error) { next(error); }
  });

  app.put('/api/v2/quotes/:id', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const existing = await findQuote(client, req.workspaceId, req.params.id, false);
      if (!existing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cotización no encontrada' }); }
      const saved = await saveQuote(client, req.workspaceId, req.user.sub, req.body || {}, existing, 'saved');
      await addQuoteEvent(client, req.workspaceId, saved.id, 'updated', req.user.sub, null, { total: saved.calculated.total });
      await client.query('COMMIT');
      res.json({ data: await findQuote(client, req.workspaceId, saved.id) });
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); } finally { client.release(); }
  });

  app.post('/api/v2/quotes/:id/send', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const existing = await findQuote(client, req.workspaceId, req.params.id);
      if (!existing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cotización no encontrada' }); }
      const body = { ...existing, ...req.body, items: existing.items };
      const calculated = calculateQuote(body);
      validateForSend(body, calculated);
      const channel = body.send_channel || req.body?.send_channel || 'link';
      if (channel === 'whatsapp') {
        if (!existing.phone_e164) throw badRequest('El contacto no tiene teléfono para WhatsApp');
        const waha = await getIntegrationConfig(req.workspaceId, 'waha');
        const config = { ...getWahaConfig(), ...(waha.config || {}) };
        const digits = String(existing.phone_e164).replace(/\D/g, '');
        const publicUrl = `${process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`}/quote/${existing.id}`;
        await sendText({ session: config.session || 'default', wahaConfig: config, chatId: `${digits}@c.us`, text: `Hola ${existing.contact_name || ''}, te compartimos la cotización ${existing.quote_number} por ${existing.currency} ${Number(existing.total).toFixed(2)}: ${publicUrl}` });
      }
      const updated = await client.query(`UPDATE quotes SET status='sent',locked_at=now(),send_channel=$1,version=version+1,updated_at=now() WHERE id=$2 AND workspace_id=$3 RETURNING *`, [channel, existing.id, req.workspaceId]);
      await addQuoteEvent(client, req.workspaceId, existing.id, 'sent', req.user.sub, channel, { version: updated.rows[0].version });
      await client.query('COMMIT');
      res.json({ data: await findQuote(client, req.workspaceId, existing.id) });
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); } finally { client.release(); }
  });

  app.post('/api/v2/quotes/:id/duplicate', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const source = await findQuote(client, req.workspaceId, req.params.id);
      if (!source) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cotización no encontrada' }); }
      const copy = await saveQuote(client, req.workspaceId, req.user.sub, { ...source, items: source.items, payment_plan: source.payment_plan, fiscal_data: source.fiscal_data, payment_method: source.payment_method }, null, 'draft');
      await addQuoteEvent(client, req.workspaceId, copy.id, 'duplicated', req.user.sub, null, { source_quote_id: source.id });
      await client.query('COMMIT');
      res.status(201).json({ data: await findQuote(client, req.workspaceId, copy.id) });
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); } finally { client.release(); }
  });

  app.post('/api/v2/quotes/:id/view', async (req, res, next) => {
    try {
      const result = await getPool().query(`UPDATE quotes SET status=CASE WHEN status='sent' THEN 'viewed' ELSE status END,updated_at=now() WHERE id=$1 RETURNING id,status`, [req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Cotización no encontrada' });
      res.json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.get('/api/v2/contacts/:id/profile', requireV2Auth, async (req, res, next) => {
    try {
      const db = getPool();
      const contact = await db.query('SELECT * FROM contacts WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId]);
      if (!contact.rows[0]) return res.status(404).json({ error: 'Contacto no encontrado' });
      const notes = await db.query('SELECT n.*,u.name AS author_name FROM contact_notes n LEFT JOIN users u ON u.id=n.created_by WHERE n.contact_id=$1 AND n.workspace_id=$2 ORDER BY n.created_at DESC', [req.params.id, req.workspaceId]);
       const history = await db.query(`SELECT ae.event_type,ae.entity_type,ae.entity_id,ae.actor_type,ae.actor_id,ae.after_data,ae.created_at FROM audit_events ae WHERE ae.workspace_id=$1 AND ((ae.entity_type='contact' AND ae.entity_id::text=$2::text) OR (ae.entity_type='quote' AND ae.after_data->>'contact_id'=$2::text)) ORDER BY ae.created_at DESC LIMIT 100`, [req.workspaceId, req.params.id]);
      res.json({ data: { contact: contact.rows[0], notes: notes.rows, history: history.rows } });
    } catch (error) { next(error); }
  });

  app.patch('/api/v2/contacts/:id/profile', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    try {
      const allowed = ['name', 'phone_e164', 'email', 'company', 'source', 'channel', 'priority', 'attention_status', 'assigned_user_id', 'pipeline_stage', 'tags', 'tax_data', 'custom_fields'];
      const entries = Object.entries(req.body || {}).filter(([key]) => allowed.includes(key));
      if (!entries.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
      if (req.body.phone_e164 && !/^\+\d{8,15}$/.test(String(req.body.phone_e164).replace(/[\s()-]/g, ''))) return res.status(400).json({ error: 'El teléfono debe estar en formato internacional' });
      if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(req.body.email))) return res.status(400).json({ error: 'El correo no es válido' });
      const values = entries.map(([, value]) => value);
      const sets = entries.map(([key], index) => `${key}=$${index + 1}`).join(',');
      values.push(req.params.id, req.workspaceId);
      const result = await getPool().query(`UPDATE contacts SET ${sets},updated_at=now() WHERE id=$${values.length - 1} AND workspace_id=$${values.length} RETURNING *`, values);
      if (!result.rows[0]) return res.status(404).json({ error: 'Contacto no encontrado' });
      res.json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.post('/api/v2/contacts/:id/notes', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    try {
      if (!req.body?.body?.trim()) return res.status(400).json({ error: 'La nota no puede estar vacía' });
      const result = await getPool().query('INSERT INTO contact_notes (workspace_id,contact_id,body,attachments,created_by) SELECT $1,id,$3,$4,$5 FROM contacts WHERE id=$2 AND workspace_id=$1 RETURNING *', [req.workspaceId, req.params.id, req.body.body.trim(), req.body.attachments || [], req.user.sub]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Contacto no encontrado' });
      res.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.get('/quote/:id/pdf', async (req, res, next) => {
    try {
      const quote = await findQuote(getPool(), null, req.params.id);
      if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
      const safe = value => String(value ?? '');
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${quote.quote_number || 'cotizacion'}.pdf"`);
      doc.pipe(res);
      doc.fillColor('#4f2bb8').fontSize(24).font('Helvetica-Bold').text('LUMARK');
      doc.fillColor('#17151d').fontSize(18).text(`Cotización ${safe(quote.quote_number)}`);
      doc.fillColor('#756d80').fontSize(11).font('Helvetica').text(`Cliente: ${safe(quote.contact_name || 'Sin contacto')}`);
      doc.text(`Fecha de vigencia: ${safe(quote.valid_until || 'No especificada')}`);
      doc.moveDown();
      doc.strokeColor('#e8e2f0').moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown();
      for (const item of quote.items || []) {
        const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
        doc.fillColor('#17151d').fontSize(11).font('Helvetica-Bold').text(safe(item.name));
        doc.font('Helvetica').fillColor('#756d80').text(`${item.quantity} x ${quote.currency} ${Number(item.unit_price).toFixed(2)} = ${quote.currency} ${lineTotal.toFixed(2)}`);
        if (item.description) doc.text(safe(item.description));
        doc.moveDown(0.5);
      }
      doc.moveDown();
      doc.fillColor('#17151d').fontSize(12).font('Helvetica').text(`Subtotal: ${quote.currency} ${Number(quote.subtotal).toFixed(2)}`);
      doc.text(`Impuestos: ${quote.currency} ${Number(quote.tax_amount).toFixed(2)}`);
      doc.font('Helvetica-Bold').fontSize(18).text(`Total: ${quote.currency} ${Number(quote.total).toFixed(2)}`);
      if (quote.message) { doc.moveDown(); doc.font('Helvetica').fontSize(11).text(safe(quote.message)); }
      doc.end();
    } catch (error) { next(error); }
  });
}

module.exports = { registerQuoteRoutes, calculateQuote, validatePaymentPlan, normalizeItems };
