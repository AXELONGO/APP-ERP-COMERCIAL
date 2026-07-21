const { google } = require('googleapis');
const path = require('path');
const https = require('https');

async function testAuth() {
  const OriginalDate = Date;
  let timeOffset = 0;
  
  try {
    const data = await new Promise((resolve, reject) => {
      https.get('https://www.google.com', { rejectUnauthorized: false }, (res) => {
        const dateHeader = res.headers.date;
        resolve(new Date(dateHeader).getTime());
      }).on('error', reject);
    });
    
    timeOffset = data - OriginalDate.now();
    console.log("Offset calculated:", timeOffset);
    
    // Monkey patch Date
    global.Date = class extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(OriginalDate.now() + timeOffset);
        } else {
          super(...args);
        }
      }
    };
    global.Date.now = () => OriginalDate.now() + timeOffset;
    
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI',
      range: 'Clientes!A2:E2',
    });
    console.log("SUCCESS:", r.data.values);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
testAuth();
