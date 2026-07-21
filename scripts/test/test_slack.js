const fetch = require('node-fetch').default || require('node-fetch');

async function testSlack(token, channel) {
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        channel: channel,
        text: `Hola desde ERP LUMARK! Probando canal ${channel}`
      })
    });
    const data = await res.json();
    console.log(`Channel ${channel} result:`, data);
  } catch (e) {
    console.error('Error:', e);
  }
}

async function run() {
  await testSlack('xoxb-11556400066550-11587464780592-iFoe6jbD4PKC0wExEUrYJwta', '#general');
  await testSlack('xoxb-11556400066550-11587464780592-iFoe6jbD4PKC0wExEUrYJwta', '#avisos-generales');
}
run();
