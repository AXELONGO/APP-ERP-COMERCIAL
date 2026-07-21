const http = require('http');

async function testSubmit() {
  // Simulate what the browser does
  const body = {
    nombre: "Cita Test Webhook",
    idProyecto: "PRJ-001",
    idCliente: "CLI-001",
    tipo: "Diagnóstico",
    fecha: "2026-07-10",
    hora: "14:30"
  };

  const API = 'http://localhost:3000';
  console.log('Sending POST to ERP API...');
  const r = await fetch(`${API}/api/citas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const result = await r.json();
  console.log('API Response:', result);

  if (result.success) {
    const recordId = result.id || body['ID'] || null;
    const url = 'https://demian405-n8n-free.hf.space/webhook/CITAS';
    const payload = {
      event_id: "evt_test",
      schema_version: "1.0",
      module: "citas",
      event_type: "citas.created",
      trigger_source: "create",
      record_id: recordId,
      button_action_id: null,
      sent_at: new Date().toISOString(),
      data: body,
      form_data: null
    };

    console.log('Sending Webhook...');
    const w = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (w.ok) {
        console.log('Webhook Response:', await w.json());
    } else {
        console.error('Webhook Failed', w.status, await w.text());
    }
  }
}

testSubmit();
