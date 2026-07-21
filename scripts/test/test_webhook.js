const payload = {
  event_id: "evt_test",
  schema_version: "1.0",
  module: "citas",
  event_type: "citas.created",
  trigger_source: "create",
  record_id: "CIT-001",
  button_action_id: null,
  sent_at: new Date().toISOString(),
  data: {
    nombre: "Test Cita desde ERP",
    fecha: "2026-07-08",
    hora: "10:00",
    idProyecto: "PRJ-001"
  }
};

fetch('https://demian405-n8n-free.hf.space/webhook/CITAS', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(r => r.json().then(j => console.log(r.status, j)))
.catch(e => console.error(e));
