const { getPool } = require('../config/database');
const { requireV2Auth, requireRole } = require('../middleware/v2Auth');

const WRITE_ROLES = ['admin', 'supervisor', 'advisor'];
const MANAGE_ROLES = ['admin', 'supervisor'];

function registerV2SalesRoutes(app) {
  app.get('/api/v2/pipeline/stages', requireV2Auth, async (req, res, next) => {
    try {
      const result = await getPool().query(
        `SELECT id, name, slug, color, position, max_days, requirements, active
         FROM pipeline_stages WHERE workspace_id = $1 AND active = true
         ORDER BY position ASC, name ASC`,
        [req.workspaceId]
      );
      res.json({ data: result.rows });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v2/pipeline/stages', requireV2Auth, requireRole(...MANAGE_ROLES), async (req, res, next) => {
    try {
      const { name, slug, color = '#64748b', position = 0, max_days = null, requirements = {} } = req.body || {};
      if (!name || !slug) return res.status(400).json({ error: 'name y slug son obligatorios' });

      const result = await getPool().query(
        `INSERT INTO pipeline_stages (workspace_id, name, slug, color, position, max_days, requirements)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.workspaceId, name.trim(), slug.trim().toLowerCase(), color, position, max_days, requirements]
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'La etapa ya existe' });
      next(error);
    }
  });

  app.patch('/api/v2/conversations/:id/assignment', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    try {
      const { assigned_user_id = null } = req.body || {};
      const result = await getPool().query(
        `UPDATE conversations SET assigned_user_id = $1, updated_at = now()
         WHERE id = $2 AND workspace_id = $3 RETURNING id, assigned_user_id, status, pipeline_stage`,
        [assigned_user_id, req.params.id, req.workspaceId]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Conversación no encontrada' });
      await audit(req, 'conversation.assigned', 'conversation', req.params.id, { assigned_user_id });
      res.json({ data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/v2/conversations/:id/stage', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    const client = await getPool().connect();
    try {
      const { stage } = req.body || {};
      if (!stage) return res.status(400).json({ error: 'stage es obligatorio' });

      await client.query('BEGIN');
      const conversation = await client.query(
        `SELECT id, pipeline_stage FROM conversations
         WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [req.params.id, req.workspaceId]
      );
      if (!conversation.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Conversación no encontrada' });
      }

      const stageExists = await client.query(
        'SELECT slug, requirements FROM pipeline_stages WHERE workspace_id = $1 AND slug = $2 AND active = true',
        [req.workspaceId, stage]
      );
      if (!stageExists.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La etapa no existe o está inactiva' });
      }

      const updated = await client.query(
        `UPDATE conversations SET pipeline_stage = $1, updated_at = now()
         WHERE id = $2 AND workspace_id = $3 RETURNING id, pipeline_stage, updated_at`,
        [stage, req.params.id, req.workspaceId]
      );
      await client.query(
        `INSERT INTO stage_history (workspace_id, conversation_id, from_stage, to_stage, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.workspaceId, req.params.id, conversation.rows[0].pipeline_stage, stage, req.user.sub]
      );
      await client.query(
        `INSERT INTO audit_events (workspace_id, event_type, entity_type, entity_id, actor_type, actor_id, before_data, after_data)
         VALUES ($1,'stage.changed','conversation',$2,'user',$3,$4,$5)`,
        [req.workspaceId, req.params.id, req.user.sub, { pipeline_stage: conversation.rows[0].pipeline_stage }, { pipeline_stage: stage }]
      );
      await client.query('COMMIT');
      res.json({ data: updated.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  });

  app.get('/api/v2/appointments', requireV2Auth, async (req, res, next) => {
    try {
      const result = await getPool().query(
        `SELECT a.*, c.name AS contact_name, c.phone_e164, u.name AS advisor_name
         FROM appointments a
         JOIN contacts c ON c.id = a.contact_id
         LEFT JOIN users u ON u.id = a.assigned_user_id
         WHERE a.workspace_id = $1
           AND ($2 = '' OR a.status = $2)
           AND ($3 = '' OR a.starts_at >= $3::timestamptz)
           AND ($4 = '' OR a.starts_at < $4::timestamptz)
         ORDER BY a.starts_at ASC LIMIT $5`,
        [req.workspaceId, req.query.status || '', req.query.from || '', req.query.to || '', parseLimit(req.query.limit)]
      );
      res.json({ data: result.rows });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v2/appointments', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    const client = await getPool().connect();
    try {
      const {
        contact_id, assigned_user_id = null, appointment_type,
        starts_at, ends_at, timezone, location = null, notes = null,
        provider = 'internal', provider_event_id = null,
      } = req.body || {};
      const idempotencyKey = req.get('Idempotency-Key') || req.body?.idempotency_key || null;
      if (!contact_id || !appointment_type || !starts_at || !ends_at || !timezone) {
        return res.status(400).json({ error: 'contact_id, appointment_type, starts_at, ends_at y timezone son obligatorios' });
      }

      await client.query('BEGIN');
      const contact = await client.query('SELECT id FROM contacts WHERE id = $1 AND workspace_id = $2', [contact_id, req.workspaceId]);
      if (!contact.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Contacto no encontrado' });
      }

      if (idempotencyKey) {
        const existing = await client.query('SELECT * FROM appointments WHERE workspace_id = $1 AND idempotency_key = $2', [req.workspaceId, idempotencyKey]);
        if (existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(200).json({ data: existing.rows[0], idempotent: true });
        }
      }

      const overlap = await client.query(
        `SELECT id FROM appointments
         WHERE workspace_id = $1 AND status NOT IN ('cancelled','no_show')
           AND ($2::uuid IS NULL OR assigned_user_id = $2)
           AND tstzrange(starts_at, ends_at, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
         LIMIT 1 FOR UPDATE`,
        [req.workspaceId, assigned_user_id, starts_at, ends_at]
      );
      if (overlap.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'El horario ya no está disponible' });
      }

      const inserted = await client.query(
        `INSERT INTO appointments (workspace_id, contact_id, assigned_user_id, appointment_type, starts_at, ends_at, timezone, location, notes, provider, provider_event_id, idempotency_key, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [req.workspaceId, contact_id, assigned_user_id, appointment_type, starts_at, ends_at, timezone, location, notes, provider, provider_event_id, idempotencyKey, req.user.sub]
      );
      await client.query(
        `INSERT INTO audit_events (workspace_id, event_type, entity_type, entity_id, actor_type, actor_id, after_data)
         VALUES ($1,'appointment.created','appointment',$2,'user',$3,$4)`,
        [req.workspaceId, inserted.rows[0].id, req.user.sub, inserted.rows[0]]
      );
      await client.query('COMMIT');
      res.status(201).json({ data: inserted.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') return res.status(409).json({ error: 'La cita ya existe' });
      next(error);
    } finally {
      client.release();
    }
  });

  app.patch('/api/v2/appointments/:id/cancel', requireV2Auth, requireRole(...WRITE_ROLES), async (req, res, next) => {
    try {
      const result = await getPool().query(
        `UPDATE appointments SET status = 'cancelled', notes = COALESCE($1, notes), updated_at = now()
         WHERE id = $2 AND workspace_id = $3 AND status NOT IN ('cancelled','attended') RETURNING *`,
        [req.body?.reason || null, req.params.id, req.workspaceId]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Cita no encontrada o no cancelable' });
      await audit(req, 'appointment.cancelled', 'appointment', req.params.id, result.rows[0]);
      res.json({ data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });
}

function parseLimit(value) {
  const parsed = Number(value || 50);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 100) : 50;
}

async function audit(req, eventType, entityType, entityId, afterData) {
  await getPool().query(
    `INSERT INTO audit_events (workspace_id, event_type, entity_type, entity_id, actor_type, actor_id, after_data)
     VALUES ($1,$2,$3,$4,'user',$5,$6)`,
    [req.workspaceId, eventType, entityType, entityId, req.user.sub, afterData]
  );
}

module.exports = { registerV2SalesRoutes };
