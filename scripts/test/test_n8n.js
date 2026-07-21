async function run() {
  const urls = [
    { name: 'CITAS', url: 'https://demian405-n8n-free.hf.space/webhook/5649c541-fd91-4f8b-ba90-5da4cd767b96' },
    { name: 'TAREAS', url: 'https://demian405-n8n-free.hf.space/webhook/TAREAS' },
    { name: 'PROYECTOS', url: 'https://demian405-n8n-free.hf.space/webhook/PROYECTOS' },
    { name: 'PROSPECTOS', url: 'https://demian405-n8n-free.hf.space/webhook/PROSPECTOS' }
  ];

  for (let u of urls) {
    try {
      const res = await fetch(u.url, { method: 'POST', body: JSON.stringify({test:1}), headers:{'Content-Type':'application/json'} });
      console.log(u.name, res.status);
    } catch(e) {
      console.log(u.name, 'Error', e.message);
    }
  }
}
run();
