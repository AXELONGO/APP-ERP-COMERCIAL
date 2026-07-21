const { google } = require('googleapis');
async function test() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'does_not_exist.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.getClient();
    console.log("Success");
  } catch(e) {
    console.log("Error:", e.message);
  }
}
test();
