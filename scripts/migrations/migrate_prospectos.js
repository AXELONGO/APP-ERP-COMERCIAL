const fetch = require('node-fetch').default || require('node-fetch');
const url = 'http://localhost:3000/api/prospectos';

async function run() {
  console.log("Fetching prospectos...");
  const data = await fetch(url).then(r => r.json());
  let count = 0;
  for (const p of data) {
    if (!p['Etapa']) {
      await fetch(url + '/' + p['ID Prospectos'], {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa: 'Nuevo' })
      });
      console.log('Updated', p['ID Prospectos']);
      count++;
    }
  }
  console.log('Total migrated:', count);
}
run();
