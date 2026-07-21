const fetch = require('node-fetch').default || require('node-fetch');

async function testSlack(token) {
  try {
    const res = await fetch('https://slack.com/api/conversations.list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (data.ok) {
        console.log("Channels found:", data.channels.map(c => c.name));
    } else {
        console.log("Error:", data);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testSlack('xoxb-11556400066550-11587464780592-iFoe6jbD4PKC0wExEUrYJwta');
