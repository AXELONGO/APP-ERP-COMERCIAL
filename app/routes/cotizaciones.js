const asyncHandler = require('../middleware/asyncHandler');
const { getSheets, getPublicData, findRowById, getSheetId, SPREADSHEET_ID } = require('../config/sheets');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SHEET_NAME = 'Cotizaciones';
const PREFIX = 'COT-';
const RANGE = 'A:L';

function registerCotizacionesRoutes(app) {
  // Ensure column L header exists
  (async () => {
    try {
      const sheets = await getSheets();
      const sid = await getSheetId(sheets, SHEET_NAME);
      if (sid) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_NAME}'!L1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['IVA Rate']] },
        });
      }
    } catch (_) { /* sheet might not exist yet */ }
  })();
  // GET /api/cotizaciones
  app.get('/api/cotizaciones', asyncHandler(async (req, res) => {
    const data = await getPublicData(SHEET_NAME);
    res.json(data);
  }));

  // POST /api/cotizaciones
  app.post('/api/cotizaciones', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const d = req.body;

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:A`,
    });
    const ids = (getRes.data.values || []).flat().filter(Boolean);
    let nextNum = 1;
    ids.forEach(id => {
      const match = id.match(/COT-(\d+)/);
      if (match) nextNum = Math.max(nextNum, parseInt(match[1]) + 1);
    });
    const newId = `${PREFIX}${String(nextNum).padStart(3, '0')}`;

    const servicios = d.servicios || [];
    const serviciosStr = servicios.map((s, i) => `${s.descripcion||''}|${s.cantidad||1}|${s.precio||0}`).join('||');

    const subtotal = servicios.reduce((sum, s) => sum + (parseFloat(s.cantidad) || 0) * (parseFloat(s.precio) || 0), 0);
    const ivaRate = parseFloat(d.ivaRate) || 0;
    const impuesto = subtotal * (ivaRate / 100);
    const total = subtotal + impuesto;

    const row = [
      newId,
      d.cliente || '',
      d.fecha || new Date().toISOString().split('T')[0],
      d.vencimiento || '',
      d.email || '',
      d.telefono || '',
      serviciosStr,
      subtotal.toFixed(2),
      impuesto.toFixed(2),
      total.toFixed(2),
      d.notas || '',
      String(ivaRate),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:L`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    res.json({ success: true, id: newId });
  }));

  // PUT /api/cotizaciones/:id
  app.put('/api/cotizaciones/:id', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const d = req.body;

    const rowNum = await findRowById(sheets, SHEET_NAME, req.params.id);
    if (rowNum === -1) return res.status(404).json({ success: false, error: 'No encontrada' });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!${RANGE}`,
    });
    const existing = (getRes.data.values || [])[rowNum - 1] || [];

    const fieldMap = {
      cliente: 1, fecha: 2, vencimiento: 3, email: 4, telefono: 5,
      notas: 10, ivaRate: 11,
    };

    for (const [key, idx] of Object.entries(fieldMap)) {
      if (d[key] !== undefined) existing[idx] = String(d[key]);
    }

    if (d.servicios) {
      const serviciosStr = d.servicios.map(s => `${s.descripcion||''}|${s.cantidad||1}|${s.precio||0}`).join('||');
      existing[6] = serviciosStr;
      const subtotal = d.servicios.reduce((sum, s) => sum + (parseFloat(s.cantidad) || 0) * (parseFloat(s.precio) || 0), 0);
      const ivaRate = parseFloat(existing[11]) || 0;
      existing[7] = subtotal.toFixed(2);
      existing[8] = (subtotal * (ivaRate / 100)).toFixed(2);
      existing[9] = (subtotal * (1 + ivaRate / 100)).toFixed(2);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A${rowNum}:L${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [existing] },
    });

    res.json({ success: true });
  }));

  // DELETE /api/cotizaciones/:id
  app.delete('/api/cotizaciones/:id', asyncHandler(async (req, res) => {
    const sheets = await getSheets();
    const sheetId = await getSheetId(sheets, SHEET_NAME);

    const rowNum = await findRowById(sheets, SHEET_NAME, req.params.id);
    if (rowNum === -1) return res.status(404).json({ success: false, error: 'No encontrada' });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
          },
        }],
      },
    });

    res.json({ success: true });
  }));

  // GET /api/cotizaciones/:id/pdf — generate and return PDF
  app.get('/api/cotizaciones/:id/pdf', asyncHandler(async (req, res) => {
    const data = await getPublicData(SHEET_NAME);
    const record = data.find(r => r['ID Cotización'] === req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'No encontrada' });

    const serviciosRaw = record['Servicios'] || '';
    const servicios = serviciosRaw.split('||').filter(Boolean).map(s => {
      const parts = s.split('|');
      return { descripcion: parts[0] || '', cantidad: parseInt(parts[1]) || 1, precio: parseFloat(parts[2]) || 0 };
    });

    function loadBlackLogo() {
      const logoPath = path.join(__dirname, '../../public/logo.png');
      if (!fs.existsSync(logoPath)) return null;
      const buf = fs.readFileSync(logoPath);
      const png = PNG.sync.read(buf);
      for (let i = 0; i < png.data.length; i += 4) {
        if (png.data[i + 3] > 0) {
          png.data[i] = 0;
          png.data[i + 1] = 0;
          png.data[i + 2] = 0;
        }
      }
      return PNG.sync.write(png);
    }

    const doc = new PDFDocument({ margin: 57, size: 'LETTER' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Cotizacion_${req.params.id}.pdf"`);
    doc.pipe(res);

    const primary = '#000000';
    const gray = '#6b7280';
    const dark = '#1f2937';
    const light = '#f3f4f6';
    const white = '#ffffff';

    const ml = 57;
    const mr = doc.page.width - 57;
    const bodyW = mr - ml;
    const centerX = (ml + mr) / 2;
    const infoLeft = 330;

    function separador(y) {
      doc.moveTo(ml, y).lineTo(mr, y).lineWidth(1).strokeColor('#e5e7eb').stroke();
    }

    function totalLine(label, value, y, opts) {
      const size = opts?.size || 10;
      const bold = opts?.bold || false;
      const color = opts?.color || dark;
      const bx = 290;
      const bw = mr - bx;
      doc.fontSize(size).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
      doc.text(label, bx, y);
      doc.text(value, bx, y, { width: bw, align: 'right' });
    }

    // ── HEADER: LOGO (left) + TITLE (centered) ──
    const blackLogo = loadBlackLogo();
    if (blackLogo) {
      doc.image(blackLogo, ml, 57, { width: 110 });
    }
    doc.fontSize(24).font('Helvetica-Bold').fillColor(primary).text('COTIZACIÓN', centerX, 57, { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor(gray).text(`Folio: ${record['ID Cotización'] || req.params.id}`, centerX, 83, { align: 'center' });

    // ── COMPANY INFO (left) + DATES (right) ──
    doc.fontSize(9).font('Helvetica').fillColor(dark)
      .text('contacto@lumarkgroup.com', ml, 118)
      .text('664 252 3031', ml, 134)
      .text('lumarkgroup.com', ml, 150);

    doc.fontSize(9).font('Helvetica')
      .fillColor(dark).text('Fecha:', infoLeft, 118, { continued: true })
      .fillColor(gray).text(`  ${record['Fecha'] || '—'}`)
      .fillColor(dark).text('Vence:', infoLeft, 136, { continued: true })
      .fillColor(gray).text(`  ${record['Vencimiento'] || '—'}`);

    separador(172);

    // ── PROSPECTO BLOCK ──
    const bx = 188;
    doc.rect(ml, bx, bodyW, 60).fill(light);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(primary).text('DATOS DEL PROSPECTO', ml + 12, bx + 8);
    doc.fontSize(10).font('Helvetica').fillColor(dark).text(record['Cliente'] || '—', ml + 12, bx + 26);
    doc.fontSize(9).fillColor(gray).text(record['Email'] || '', ml + 12, bx + 44);
    doc.fontSize(9).fillColor(gray).text(record['Teléfono'] || '', infoLeft, bx + 44);

    // ── TABLE ──
    const ty = bx + 85;
    const th = 20;
    const cx = [ml, ml + 30, ml + 150, ml + 330, ml + 395];
    const cw = [30, 120, 180, 65, 67];

    doc.rect(ml, ty, bodyW, th).fill(primary);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(white);
    doc.text('#', cx[0], ty + 5, { width: cw[0], align: 'center' });
    doc.text('Servicio', cx[1], ty + 5, { width: cw[1] });
    doc.text('Cantidad', cx[2], ty + 5, { width: cw[2], align: 'right' });
    doc.text('Precio', cx[3], ty + 5, { width: cw[3], align: 'right' });
    doc.text('Total', cx[4], ty + 5, { width: cw[4], align: 'right' });

    let yp = ty + th + 6;
    let granTotal = 0;

    servicios.forEach((s, i) => {
      const lt = s.cantidad * s.precio;
      granTotal += lt;

      if (i % 2 === 0) {
        doc.rect(ml, yp - 2, bodyW, 16).fill('#fafafa');
      }
      doc.fontSize(9).font('Helvetica').fillColor(dark);
      doc.text(String(i + 1), cx[0], yp, { width: cw[0], align: 'center' });
      doc.text(s.descripcion || '—', cx[1], yp, { width: cw[1] });
      doc.text(String(s.cantidad), cx[2], yp, { width: cw[2], align: 'right' });
      doc.text(`$${s.precio.toFixed(2)}`, cx[3], yp, { width: cw[3], align: 'right' });
      doc.text(`$${lt.toFixed(2)}`, cx[4], yp, { width: cw[4], align: 'right' });
      yp += 16;
    });

    // ── TOTALS ──
    yp += 36;
    const ivaRate = record['IVA Rate'] !== undefined && record['IVA Rate'] !== '' ? parseFloat(record['IVA Rate']) : 16;
    const iva = granTotal * (ivaRate / 100);
    const gran = granTotal + iva;

    totalLine('Subtotal', `$${granTotal.toFixed(2)}`, yp);

    if (ivaRate > 0) {
      totalLine(`IVA (${ivaRate}%)`, `$${iva.toFixed(2)}`, yp + 22);
      doc.moveTo(290, yp + 42).lineTo(mr, yp + 42).lineWidth(1).strokeColor('#e5e7eb').stroke();
      totalLine('Total', `$${gran.toFixed(2)}`, yp + 52, { size: 12, bold: true, color: primary });
    } else {
      doc.moveTo(290, yp + 22).lineTo(mr, yp + 22).lineWidth(1).strokeColor('#e5e7eb').stroke();
      totalLine('Total', `$${granTotal.toFixed(2)}`, yp + 32, { size: 12, bold: true, color: primary });
    }

    // ── NOTES ──
    if (record['Notas']) {
      doc.moveDown(3);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(dark).text('Notas:');
      doc.fontSize(8).font('Helvetica').fillColor(gray).text(record['Notas']);
    }

    // ── FOOTER ──
    const fy = Math.min(doc.y + 40, 730);
    separador(fy - 4);
    doc.fontSize(7).font('Helvetica').fillColor(gray)
      .text('LUMARK · contacto@lumarkgroup.com · 664 252 3031 · lumarkgroup.com', ml, fy, { align: 'center', width: bodyW });

    doc.end();
  }));
}

module.exports = { registerCotizacionesRoutes };