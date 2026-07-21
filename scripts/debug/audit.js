const https = require('https');
const readline = require('readline');

const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

async function auditSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
  console.log(`Auditing ${sheetName}...`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const rows = data.split('\n').map(row => {
          // Simplistic CSV parse
          const cols = [];
          let inQuotes = false;
          let current = '';
          for (let i = 0; i < row.length; i++) {
            if (row[i] === '"') {
              inQuotes = !inQuotes;
            } else if (row[i] === ',' && !inQuotes) {
              cols.push(current);
              current = '';
            } else {
              current += row[i];
            }
          }
          cols.push(current);
          return cols;
        });
        
        const headers = rows[0];
        console.log(`[${sheetName}] Headers found:`, headers.join(' | '));
        
        if (rows.length > 1) {
          const sample = {};
          headers.forEach((h, i) => sample[h] = rows[1][i] || '');
          console.log(`[${sheetName}] Sample Row 1 parsed:`, sample);
        }
        resolve();
      });
    }).on('error', reject);
  });
}

async function run() {
  await auditSheet('Clientes');
  await auditSheet('Citas');
  console.log("Audit complete.");
}
run();
