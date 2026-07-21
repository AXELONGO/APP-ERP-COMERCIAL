const SPREADSHEET_ID = '1ZCCirL1JXtQ7UIxcxZN9i6y716xY8NgEEQC3QmJu5gI';

async function fetchPublicJSON(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();
  const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/)[1];
  const data = JSON.parse(jsonString);
  
  const headers = data.table.cols.map(c => c.label);
  const rows = data.table.rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      // Usar valor formateado (f) si existe, sino el valor crudo (v)
      let val = r.c[i] ? (r.c[i].f !== undefined ? r.c[i].f : r.c[i].v) : '';
      if (val === null) val = '';
      obj[h] = String(val);
    });
    return obj;
  });
  
  return rows;
}

fetchPublicJSON('Clientes').then(console.log).catch(console.error);
