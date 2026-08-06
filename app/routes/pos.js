const asyncHandler = require('../middleware/asyncHandler');
const { getSheets, getPublicData, findRowById, SPREADSHEET_ID } = require('../config/sheets');
const { sendInformationEvent } = require('../utils/bugReporter');

const POS_SHEETS = {
  productos: { sheet: 'POS_Productos', prefix: 'POS-PROD-', range: 'A:Q', fields: ['ID Producto', 'SKU', 'Codigo de barras', 'Nombre', 'Descripcion', 'Categoria ID', 'Marca', 'Proveedor', 'Tipo', 'Precio venta', 'Costo', 'Impuesto', 'Unidad', 'Foto URL', 'Stock minimo', 'Variantes JSON', 'Activo'] },
  categorias: { sheet: 'POS_Categorias', prefix: 'POS-CAT-', range: 'A:E', fields: ['ID Categoria', 'Nombre', 'Color', 'Icono', 'Activo'] },
  inventario: { sheet: 'POS_Inventario', prefix: 'POS-INV-', range: 'A:J', fields: ['ID Movimiento', 'Producto ID', 'Tipo', 'Cantidad', 'Stock anterior', 'Stock actual', 'Motivo', 'Venta ID', 'Actor', 'Fecha'] },
  ventas: { sheet: 'POS_Ventas', prefix: 'POS-VTA-', range: 'A:N', fields: ['ID Venta', 'Estado', 'Subtotal', 'Descuento', 'Impuestos', 'Total', 'Metodo de pago', 'Efectivo recibido', 'Cambio', 'Empleado ID', 'Caja ID', 'Correlacion ID', 'Fecha', 'Actor'] },
  detalleventas: { sheet: 'POS_DetalleVentas', prefix: 'POS-DET-', range: 'A:J', fields: ['ID Detalle', 'Venta ID', 'Producto ID', 'SKU', 'Producto', 'Cantidad', 'Precio unitario', 'Descuento', 'Impuesto', 'Total'] },
  clientes: { sheet: 'POS_Clientes', prefix: 'POS-CLI-', range: 'A:H', fields: ['ID Cliente', 'Nombre', 'Telefono', 'Correo', 'Fecha de nacimiento', 'Puntos', 'Segmento', 'Fecha de registro'] },
  empleados: { sheet: 'POS_Empleados', prefix: 'POS-EMP-', range: 'A:F', fields: ['ID Empleado', 'Nombre', 'Rol', 'PIN Hash', 'Activo', 'Fecha de registro'] },
  cortecaja: { sheet: 'POS_CorteCaja', prefix: 'POS-CJA-', range: 'A:J', fields: ['ID Corte', 'Estado', 'Apertura', 'Cierre', 'Ventas', 'Retiros', 'Gastos', 'Efectivo esperado', 'Efectivo contado', 'Diferencia'] },
  gastos: { sheet: 'POS_Gastos', prefix: 'POS-GTO-', range: 'A:G', fields: ['ID Gasto', 'Caja ID', 'Concepto', 'Monto', 'Motivo', 'Actor', 'Fecha'] },
  configuracion: { sheet: 'POS_Configuracion', prefix: 'POS-CFG-', range: 'A:D', fields: ['ID Configuracion', 'Clave', 'Valor', 'Tipo'] }
};

const PAYMENT_METHODS = new Set(['Efectivo', 'Tarjeta', 'Transferencia', 'Mercado Pago', 'Mixto']);
const saleIdempotency = new Map();

function value(body, key, existing, fallback = '') {
  return body[key] !== undefined ? body[key] : (existing || fallback);
}

function mapBody(body, existing = [], fields) {
  return fields.map((field, index) => {
    if (index === 0) return existing[0] || '';
    const key = field.replace(/[^a-zA-Z0-9]+(.)/g, (_, character) => character.toUpperCase()).replace(/^[A-Z]/, character => character.toLowerCase());
    return value(body, key, existing[index]);
  });
}

async function nextId(sheets, config) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${config.sheet}'!A:A` });
  const rows = response.data.values || [];
  const highest = rows.slice(1).reduce((max, row) => {
    const match = row[0] ? String(row[0]).match(/\d+/) : null;
    return match ? Math.max(max, Number.parseInt(match[0], 10)) : max;
  }, 0);
  return `${config.prefix}${String(highest + 1).padStart(4, '0')}`;
}

async function appendRow(sheets, sheet, row) {
  await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: `'${sheet}'!A:A`, valueInputOption: 'USER_ENTERED', resource: { values: [row] } });
}

async function updateRow(sheets, sheet, id, row) {
  const rowNumber = await findRowById(sheets, sheet, id);
  if (rowNumber < 1) throw new Error(`Registro ${id} no encontrado en ${sheet}`);
  await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `'${sheet}'!A${rowNumber}`, valueInputOption: 'USER_ENTERED', resource: { values: [row] } });
}

function actorFromRequest(req) {
  return { user_id: req.get('x-user-id') || null, user_name: req.get('x-user-name') || req.body?.actor || 'POS', source: req.get('x-source') || 'pos' };
}

function registerCrud(app, endpoint, config) {
  app.get(`/api/pos_${endpoint}`, asyncHandler(async (req, res) => res.json(await getPublicData(config.sheet))));
  app.post(`/api/pos_${endpoint}`, asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const id = await nextId(sheets, config);
    const row = mapBody(req.body || {}, [id], config.fields);
    await appendRow(sheets, config.sheet, row);
    res.status(201).json({ success: true, id });
  }));
  app.put(`/api/pos_${endpoint}/:id`, asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const rowNumber = await findRowById(sheets, config.sheet, req.params.id);
    if (rowNumber < 1) return res.status(404).json({ error: 'Registro no encontrado' });
    const current = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${config.sheet}'!A${rowNumber}:Z${rowNumber}`, valueRenderOption: 'FORMULA' });
    await updateRow(sheets, config.sheet, req.params.id, mapBody(req.body || {}, current.data.values?.[0] || [req.params.id], config.fields));
    res.json({ success: true });
  }));
}

function registerPosRoutes(app) {
  Object.entries(POS_SHEETS).forEach(([endpoint, config]) => registerCrud(app, endpoint, config));

  app.post('/api/pos/checkout', asyncHandler(async (req, res) => {
    const { items, metodoPago, efectivoRecibido = 0, cajaId = '', actor = 'POS', correlacionId } = req.body || {};
    if (!correlacionId) return res.status(400).json({ error: 'correlacionId es obligatorio' });
    if (saleIdempotency.has(correlacionId)) return res.json(saleIdempotency.get(correlacionId));
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'La venta debe incluir productos' });
    if (!PAYMENT_METHODS.has(metodoPago)) return res.status(400).json({ error: 'Metodo de pago no valido' });

    const products = await getPublicData('POS_Productos');
    const inventory = await getPublicData('POS_Inventario');
    const productMap = new Map(products.map(product => [product['ID Producto'], product]));
    const stockMap = new Map();
    inventory.forEach(move => stockMap.set(move['Producto ID'], Number(move['Stock actual'] || 0)));
    const normalized = items.map(item => {
      const product = productMap.get(String(item.productoId));
      const quantity = Number(item.cantidad);
      if (!product || !Number.isFinite(quantity) || quantity <= 0) throw new Error('Producto o cantidad invalida');
      const stock = stockMap.get(String(item.productoId)) || 0;
      if (stock < quantity) throw new Error(`Stock insuficiente para ${product.Nombre || item.productoId}`);
      const price = Number(product['Precio venta'] || 0);
      return { product, quantity, stock, price, total: price * quantity };
    });
    const subtotal = normalized.reduce((sum, item) => sum + item.total, 0);
    const paid = Number(efectivoRecibido) || 0;
    if (metodoPago === 'Efectivo' && paid < subtotal) return res.status(400).json({ error: 'El efectivo recibido es menor al total' });
    const change = metodoPago === 'Efectivo' ? paid - subtotal : 0;
    const sheets = await getSheets();
    const sales = POS_SHEETS.ventas;
    const saleId = await nextId(sheets, sales);
    const now = new Date().toISOString();
    const saleRow = [saleId, 'Pendiente', subtotal, 0, 0, subtotal, metodoPago, paid, change, '', cajaId, correlacionId, now, actor];
    await appendRow(sheets, sales.sheet, saleRow);
    try {
      for (const item of normalized) {
        const detail = POS_SHEETS.detalleventas;
        await appendRow(sheets, detail.sheet, [await nextId(sheets, detail), saleId, item.product['ID Producto'], item.product.SKU, item.product.Nombre, item.quantity, item.price, 0, 0, item.total]);
        const movement = POS_SHEETS.inventario;
        await appendRow(sheets, movement.sheet, [await nextId(sheets, movement), item.product['ID Producto'], 'Venta', -item.quantity, item.stock, item.stock - item.quantity, 'Venta POS', saleId, actor, now]);
      }
      const confirmed = [...saleRow];
      confirmed[1] = 'Confirmada';
      await updateRow(sheets, sales.sheet, saleId, confirmed);
    } catch (error) {
      await updateRow(sheets, sales.sheet, saleId, [...saleRow.slice(0, 1), 'Error', ...saleRow.slice(2)]).catch(() => {});
      throw error;
    }
    const result = { success: true, ventaId: saleId, total: subtotal, cambio: change, correlacionId };
    saleIdempotency.set(correlacionId, result);
    await sendInformationEvent({ category: 'pos', module: 'ventas', event_type: 'pos.venta.confirmada', trigger_source: 'checkout', record_id: saleId, previous_value: 'Pendiente', new_value: 'Confirmada', actor: actorFromRequest(req), persistence_result: 'confirmed', correlation_id: correlacionId, data: result });
    res.json(result);
  }));
}

module.exports = { registerPosRoutes, POS_SHEETS };
