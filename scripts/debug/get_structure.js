const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: true,
      ranges: [], // We'll get all sheets, but let's restrict grid data to row 1
    });
    
    // Instead of includeGridData which might be too large, we can just get sheet names and then batchGet their first rows
    const sheetProperties = response.data.sheets.map(s => s.properties.title);
    
    const ranges = sheetProperties.map(title => `'${title}'!1:1`);
    
    const batchGetResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ranges,
    });
    
    const structure = {};
    batchGetResponse.data.valueRanges.forEach((valueRange, index) => {
      const title = sheetProperties[index];
      const headers = valueRange.values ? valueRange.values[0] : [];
      structure[title] = headers;
    });

    console.log(JSON.stringify(structure, null, 2));

  } catch (error) {
    console.error('Error fetching structure:', error.message);
  }
}

main();
