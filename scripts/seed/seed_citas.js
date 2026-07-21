const http = require('http');

const API = 'http://localhost:3000/api';
const NUM_RECORDS = 60;

const names = ['Axel', 'Laura', 'Carlos', 'Ana', 'Luis', 'Sofia', 'Jorge', 'Marta', 'Brena', 'David'];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randArr = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randDate = () => `2026-07-${String(randInt(1, 28)).padStart(2, '0')}`;

function postData(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(`${API}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function seed() {
  console.log('Seeding Citas...');
  for (let i = 0; i < NUM_RECORDS; i++) {
    await postData('citas', {
      nombre: 'Reunión ' + i,
      idProyecto: 'PRJ-' + String(randInt(100, 160)).padStart(3, '0'),
      idCliente: 'CLI-' + String(randInt(100, 160)).padStart(3, '0'),
      tipo: randArr(['Kickoff', 'Diagnóstico', 'Seguimiento', 'Presentación', 'Reporte', 'Renovación']),
      correo: `cliente${i}@test.com`,
      telefono: '555-000-' + randInt(1000, 9999),
      fecha: randDate(),
      hora: `${String(randInt(9, 18)).padStart(2, '0')}:00`,
      responsable: randArr(names),
      notas: 'Notas de la cita ' + i,
      resultado: 'Pendiente',
      proximaAccion: 'Llamar de nuevo'
    });
  }
  console.log('Done!');
}

seed();
