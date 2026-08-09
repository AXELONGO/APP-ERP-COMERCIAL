const { query } = require('../config/database');
const { hashPassword, verifyPassword } = require('../auth/passwords');
const { signToken } = require('../auth/tokens');
const { requireV2Auth, requireRole } = require('../middleware/v2Auth');

const ROLES = new Set(['admin', 'supervisor', 'advisor', 'viewer']);

function parseLimit(value, fallback = 50) {
  const limit = Number(value || fallback);
  return Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : fallback;
}

function registerV2CoreRoutes(app) {
  app.post('/api/v2/auth/login', async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios' });

      const result = await query(
        `SELECT id, workspace_id, email, name, role, password_hash, active
         FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [email.trim()]
      );
      const user = result.rows[0];
      if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const token = signToken({
        sub: user.id,
        workspace_id: user.workspace_id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
      });

      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v2/me', requireV2Auth, (req, res) => res.json({ user: req.user }));

  app.get('/api/v2/contacts', requireV2Auth, async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit);
      const search = String(req.query.search || '').trim();
      const result = await query(
        `SELECT id, name, phone_e164, email, source, assigned_user_id, pipeline_stage,
                consent_status, custom_fields, created_at, updated_at
         FROM contacts
         WHERE workspace_id = $1
           AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR phone_e164 ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%')
         ORDER BY updated_at DESC LIMIT $3`,
        [req.workspaceId, search, limit]
      );
      res.json({ data: result.rows, limit });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v2/contacts', requireV2Auth, requireRole('admin', 'supervisor', 'advisor'), async (req, res, next) => {
    const client = await requireClient(next);
    if (!client) return;
    try {
      const { name, phone_e164, email, source = 'manual', assigned_user_id = null, pipeline_stage = 'new', custom_fields = {} } = req.body || {};
      if (!name || !phone_e164) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });

      await client.query('BEGIN');
      const duplicate = await client.query(
        `SELECT id, name, phone_e164, email FROM contacts
         WHERE workspace_id = $1 AND (phone_e164 = $2 OR ($3 <> '' AND lower(email) = lower($3)))
         LIMIT 1`,
        [req.workspaceId, phone_e164, email || '']
      );
      if (duplicate.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'El contacto ya existe', contact: duplicate.rows[0] });
      }

      const inserted = await client.query(
        `INSERT INTO contacts (workspace_id, name, phone_e164, email, source, assigned_user_id, pipeline_stage, custom_fields)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.workspaceId, name.trim(), phone_e164.trim(), email?.trim() || null, source, assigned_user_id, pipeline_stage, custom_fields]
      );
      await insertAudit(client, req, 'contact.created', 'contact', inserted.rows[0].id, null, inserted.rows[0]);
      await client.query('COMMIT');
      res.status(201).json({ data: inserted.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  });

  app.get('/api/v2/conversations', requireV2Auth, async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit, 50);
      const result = await query(
        `SELECT c.*, ct.name AS contact_name, ct.phone_e164
         FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
         WHERE c.workspace_id = $1
         ORDER BY c.last_activity_at DESC LIMIT $2`,
        [req.workspaceId, limit]
      );
      res.json({ data: result.rows, limit });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v2/conversations/:id/messages', requireV2Auth, async (req, res, next) => {
    const client = await requireClient(next);
    if (!client) return;
    try {
      const { body, direction = 'outbound', channel = 'internal', provider_message_id = null } = req.body || {};
      if (!body) return res.status(400).json({ error: 'El contenido del mensaje es obligatorio' });

      await client.query('BEGIN');
      const conversation = await client.query(
        'SELECT id FROM conversations WHERE id = $1 AND workspace_id = $2 FOR UPDATE',
        [req.params.id, req.workspaceId]
      );
      if (!conversation.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Conversación no encontrada' });
      }

      const inserted = await client.query(
        `INSERT INTO messages (workspace_id, conversation_id, direction, channel, body, provider_message_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.workspaceId, req.params.id, direction, channel, body, provider_message_id, req.user.sub]
      );
      await client.query(
        `UPDATE conversations SET last_activity_at = now(), status = CASE WHEN $2 = 'inbound' THEN 'new' ELSE status END,
         updated_at = now() WHERE id = $1 AND workspace_id = $3`,
        [req.params.id, direction, req.workspaceId]
      );
      await insertAudit(client, req, 'message.created', 'conversation', req.params.id, null, inserted.rows[0]);
      await client.query('COMMIT');
      res.status(201).json({ data: inserted.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  });

  app.get('/api/v2/audit-events', requireV2Auth, requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
      const result = await query(
        `SELECT id, event_type, entity_type, entity_id, actor_type, actor_id, before_data, after_data, created_at
         FROM audit_events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [req.workspaceId, parseLimit(req.query.limit)]
      );
      res.json({ data: result.rows });
    } catch (error) {
      next(error);
    }
  });
}

async function requireClient(next) {
  try {
    return require('../config/database').getPool().connect();
  } catch (error) {
    next(error);
    return null;
  }
}

async function insertAudit(client, req, eventType, entityType, entityId, beforeData, afterData) {
  await client.query(
    `INSERT INTO audit_events (workspace_id, event_type, entity_type, entity_id, actor_type, actor_id, before_data, after_data)
     VALUES ($1,$2,$3,$4,'user',$5,$6,$7)`,
    [req.workspaceId, eventType, entityType, entityId, req.user.sub, beforeData, afterData]
  );
}

module.exports = { registerV2CoreRoutes, ROLES, hashPassword };
