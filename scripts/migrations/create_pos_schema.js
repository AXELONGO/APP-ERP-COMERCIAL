const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const spreadsheetId = process.env.SPREADSHEET_ID;
const seedDemo = process.argv.includes('--seed-demo');
const schema = [
  ['POS_Productos', ['ID Producto', 'SKU', 'Codigo de barras', 'Nombre', 'Descripcion', 'Categoria ID', 'Marca', 'Proveedor', 'Tipo', 'Precio venta', 'Costo', 'Impuesto', 'Unidad', 'Foto URL', 'Stock minimo', 'Variantes JSON', 'Activo']],
  ['POS_Categorias', ['ID Categoria', 'Nombre', 'Color', 'Icono', 'Activo']],
  ['POS_Inventario', ['ID Movimiento', 'Producto ID', 'Tipo', 'Cantidad', 'Stock anterior', 'Stock actual', 'Motivo', 'Venta ID', 'Actor', 'Fecha']],
  ['POS_Ventas', ['ID Venta', 'Estado', 'Subtotal', 'Descuento', 'Impuestos', 'Total', 'Metodo de pago', 'Efectivo recibido', 'Cambio', 'Empleado ID', 'Caja ID', 'Correlacion ID', 'Fecha', 'Actor']],
  ['POS_DetalleVentas', ['ID Detalle', 'Venta ID', 'Producto ID', 'SKU', 'Producto', 'Cantidad', 'Precio unitario', 'Descuento', 'Impuesto', 'Total']],
  ['POS_Clientes', ['ID Cliente', 'Nombre', 'Telefono', 'Correo', 'Fecha de nacimiento', 'Puntos', 'Segmento', 'Fecha de registro']],
  ['POS_Empleados', ['ID Empleado', 'Nombre', 'Rol', 'PIN Hash', 'Activo', 'Fecha de registro']],
  ['POS_CorteCaja', ['ID Corte', 'Estado', 'Apertura', 'Cierre', 'Ventas', 'Retiros', 'Gastos', 'Efectivo esperado', 'Efectivo contado', 'Diferencia']],
  ['POS_Gastos', ['ID Gasto', 'Caja ID', 'Concepto', 'Monto', 'Motivo', 'Actor', 'Fecha']],
  ['POS_Configuracion', ['ID Configuracion', 'Clave', 'Valor', 'Tipo']]
];

function getCredentials() {
  if (process.env.GOOGLE_CREDENTIALS) {
    let raw = process.env.GOOGLE_CREDENTIALS.trim();
    if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
    return { credentials: JSON.parse(raw) };
  }
  const keyFile = path.join(__dirname, '../../credentials.json');
  if (fs.existsSync(keyFile)) return { keyFile };
  throw new Error('Configura GOOGLE_CREDENTIALS o coloca credentials.json en la raiz.');
}

async function getKnownSheets(sheets) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  return new Map(response.data.sheets.map(sheet => [sheet.properties.title, sheet.properties.sheetId]));
}

async function ensureSheet(sheets, title, headers, known) {
  if (!known.has(title)) {
    const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
    known.set(title, response.data.replies[0].addSheet.properties.sheetId);
    console.log(`[POS] Pestaña creada: ${title}`);
  }
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${title}'!1:1` });
  if ((current.data.values?.[0] || []).join('|') !== headers.join('|')) {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${title}'!A1`, valueInputOption: 'RAW', resource: { values: [headers] } });
    console.log(`[POS] Encabezados verificados: ${title}`);
  }
}

async function appendIfEmpty(sheets, title, rows) {
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${title}'!A2:A` });
  if ((current.data.values || []).some(row => row[0])) return;
  await sheets.spreadsheets.values.append({ spreadsheetId, range: `'${title}'!A:A`, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
  console.log(`[POS] Datos demo cargados: ${title}`);
}

async function main() {
  if (!spreadsheetId) throw new Error('Falta SPREADSHEET_ID. No se realizo ninguna escritura.');
  const auth = new google.auth.GoogleAuth({ ...getCredentials(), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const known = await getKnownSheets(sheets);
  for (const [title, headers] of schema) await ensureSheet(sheets, title, headers, known);
  if (seedDemo) {
    await appendIfEmpty(sheets, 'POS_Categorias', [['POS-CAT-0001', 'Cafe', '#D4AF37', 'coffee', 'Si'], ['POS-CAT-0002', 'Pan dulce', '#007BFF', 'bread', 'Si']]);
    await appendIfEmpty(sheets, 'POS_Productos', [
      ['POS-PROD-0001', 'CAF-001', '750000000001', 'Cafe americano', '12 oz', 'POS-CAT-0001', 'Cafe Aurora', 'Proveedor demo', 'Producto', 48, 18, 0, 'Pieza', '', 5, '', 'Si'],
      ['POS-PROD-0002', 'CAF-002', '750000000002', 'Capuchino', '12 oz', 'POS-CAT-0001', 'Cafe Aurora', 'Proveedor demo', 'Producto', 62, 24, 0, 'Pieza', '', 5, '', 'Si'],
      ['POS-PROD-0003', 'CAF-003', '750000000003', 'Pan de canela', 'Pieza', 'POS-CAT-0002', 'Cafe Aurora', 'Proveedor demo', 'Producto', 42, 15, 0, 'Pieza', '', 8, '', 'Si']
    ]);
    await appendIfEmpty(sheets, 'POS_Inventario', [
      ['POS-INV-0001', 'POS-PROD-0001', 'Entrada', 30, 0, 30, 'Carga demo', '', 'Sistema', new Date().toISOString()],
      ['POS-INV-0002', 'POS-PROD-0002', 'Entrada', 20, 0, 20, 'Carga demo', '', 'Sistema', new Date().toISOString()],
      ['POS-INV-0003', 'POS-PROD-0003', 'Entrada', 24, 0, 24, 'Carga demo', '', 'Sistema', new Date().toISOString()]
    ]);
  }
  console.log(`[POS] Migracion completa (${schema.length} pestañas).`);
}

main().catch(error => {
  console.error(`[POS] Migracion cancelada: ${error.message}`);
  process.exitCode = 1;
});
