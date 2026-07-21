const { notifyEvent, notifyBug } = require('./utils/notifications');

async function test() {
  console.log('Testing Slack and Email Notifications...');
  
  // 1. Test CRUD Event
  await notifyEvent('CREATE', 'Prospectos', 'PRO-999', {
    Nombre: 'Test Usuario',
    Empresa: 'Test Corp',
    Monto: '$50,000'
  });
  console.log('Sent CREATE event notification.');

  // 2. Test Bug Event
  await notifyBug('Error de prueba simulado', { route: '/api/test', method: 'GET', user: 'Admin' });
  console.log('Sent BUG notification.');

  console.log('Done! Please check Slack #avisos-generales and #errores-sistema, and check email (if SMTP_PASS is configured in .env).');
}

test();
