const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_REGULAR = path.join(__dirname, 'fonts', 'Poppins-Regular.ttf');
const FONT_BOLD = path.join(__dirname, 'fonts', 'Poppins-SemiBold.ttf');

const fmtNum = (n) => new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('cs-CZ') : '—';

function generateInvoicePDF(invoice, company, items, qrDataUrl) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Faktura ${invoice.invoice_number}`, Author: company?.name || 'ERP System' } });
    doc.registerFont('Regular', FONT_REGULAR);
    doc.registerFont('Bold', FONT_BOLD);
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const co = company || {};
    const accent = co.invoice_color || '#4361ee';
    const margin = 40;
    const pageW = 555;

    const isCredit = invoice.invoice_type === 'credit_note';
    const isProforma = invoice.invoice_type === 'proforma';
    const title = isCredit ? 'DOBROPIS' : isProforma ? 'PROFORMA FAKTURA' : 'FAKTURA';

    // ─── ACCENT BAR ─────────────────────────────────────────
    doc.save();
    doc.rect(margin, 36, pageW - margin, 4).fill(accent);
    doc.restore();

    // ─── HEADER: title left, company info right ─────────────
    let y = 48;
    doc.fontSize(14).font('Bold').fillColor(accent).text(title, margin, y);
    y += 20;
    doc.fontSize(22).font('Bold').fillColor('#0f172a').text(invoice.invoice_number, margin, y);

    // Company info on the right
    const rightX = 320;
    let ry = 48;
    if (co.logo) {
      try {
        doc.image(co.logo, rightX + 60, ry, { width: 150, height: 45, fit: [150, 45], align: 'right' });
        ry += 50;
      } catch {}
    }
    doc.fontSize(12).font('Bold').fillColor('#0f172a').text(co.name || '', rightX, ry, { width: pageW - rightX, align: 'right' });
    ry += 16;
    doc.fontSize(8).font('Regular').fillColor('#64748b');
    if (co.ico) { doc.text(`IČO: ${co.ico}`, rightX, ry, { width: pageW - rightX, align: 'right' }); ry += 11; }
    if (co.dic) { doc.text(`DIČ: ${co.dic}`, rightX, ry, { width: pageW - rightX, align: 'right' }); ry += 11; }
    if (co.address) { doc.text(co.address, rightX, ry, { width: pageW - rightX, align: 'right' }); ry += 11; }
    if (co.city) { doc.text(`${co.city} ${co.zip || ''}`.trim(), rightX, ry, { width: pageW - rightX, align: 'right' }); ry += 11; }

    y = Math.max(y + 30, ry + 10);

    // ─── DODAVATEL / ODBĚRATEL (bordered box) ───────────────
    const boxTop = y;
    const midX = margin + (pageW - margin) / 2;
    const boxPad = 16;

    // Calculate content heights first
    const supplierLines = [];
    supplierLines.push({ text: 'DODAVATEL', type: 'label' });
    supplierLines.push({ text: co.name || '—', type: 'name' });
    if (co.ico) supplierLines.push({ text: `IČ: ${co.ico}`, type: 'detail' });
    if (co.dic) supplierLines.push({ text: `DIČ: ${co.dic}`, type: 'detail' });
    if (co.address) supplierLines.push({ text: co.address, type: 'detail' });
    if (co.city) supplierLines.push({ text: `${co.city} ${co.zip || ''}`.trim(), type: 'detail' });
    if (co.email) supplierLines.push({ text: co.email, type: 'detail' });
    if (co.phone) supplierLines.push({ text: co.phone, type: 'detail' });

    const clientLines = [];
    clientLines.push({ text: 'ODBĚRATEL', type: 'label' });
    clientLines.push({ text: invoice.client_name || '—', type: 'name' });
    if (invoice.client_ico) clientLines.push({ text: `IČ: ${invoice.client_ico}`, type: 'detail' });
    if (invoice.client_dic) clientLines.push({ text: `DIČ: ${invoice.client_dic}`, type: 'detail' });
    if (invoice.client_address) clientLines.push({ text: invoice.client_address, type: 'detail' });
    if (invoice.client_city) clientLines.push({ text: `${invoice.client_city} ${invoice.client_zip || ''}`.trim(), type: 'detail' });
    if (invoice.client_email) clientLines.push({ text: invoice.client_email, type: 'detail' });

    const calcH = (lines) => lines.reduce((h, l) => h + (l.type === 'label' ? 14 : l.type === 'name' ? 18 : 12), 0);
    const boxH = Math.max(100, Math.max(calcH(supplierLines), calcH(clientLines)) + 24);

    // Draw box first
    doc.roundedRect(margin, boxTop, pageW - margin, boxH, 6).stroke('#e2e8f0');
    doc.moveTo(midX, boxTop + 1).lineTo(midX, boxTop + boxH - 1).stroke('#e2e8f0');

    // Render supplier (left)
    const renderLines = (lines, startX, startY) => {
      let ly = startY;
      lines.forEach(l => {
        if (l.type === 'label') {
          doc.fontSize(8).font('Bold').fillColor('#64748b').text(l.text, startX, ly);
          ly += 14;
        } else if (l.type === 'name') {
          doc.fontSize(11).font('Bold').fillColor('#0f172a').text(l.text, startX, ly);
          ly += 18;
        } else {
          doc.fontSize(8.5).font('Regular').fillColor('#334155').text(l.text, startX, ly);
          ly += 12;
        }
      });
    };
    renderLines(supplierLines, margin + boxPad, boxTop + 12);
    renderLines(clientLines, midX + boxPad, boxTop + 12);

    y = boxTop + boxH + 16;

    // ─── PLATEBNÍ ÚDAJE (bordered box with QR) ──────────────
    if (co.bank_account || co.iban) {
      const payTop = y;
      const payH = 95;
      const qrW = 100;
      const payContentW = pageW - margin - qrW;

      doc.roundedRect(margin, payTop, pageW - margin, payH, 6).lineWidth(1.5).stroke(accent);

      // QR section background
      doc.save();
      doc.roundedRect(margin + payContentW, payTop, qrW, payH, 6).fill('#f8fafc');
      doc.restore();
      doc.moveTo(margin + payContentW, payTop + 8).lineTo(margin + payContentW, payTop + payH - 8).stroke('#e2e8f0');

      // Pay title
      let py = payTop + 12;
      doc.fontSize(8).font('Bold').fillColor(accent).text('PLATEBNÍ ÚDAJE', margin + 16, py);
      py += 16;

      // Pay table
      const labelX = margin + 16;
      const valueX = margin + 120;
      doc.fontSize(8.5).font('Regular').fillColor('#64748b');

      if (co.bank_account) {
        doc.text('Číslo účtu', labelX, py);
        doc.font('Bold').fillColor('#0f172a').text(`${co.bank_account}${co.bank_code ? '/' + co.bank_code : ''}`, valueX, py);
        py += 13;
      }
      if (invoice.variable_symbol) {
        doc.font('Regular').fillColor('#64748b').text('Variabilní symbol', labelX, py);
        doc.font('Bold').fillColor('#0f172a').text(invoice.variable_symbol, valueX, py);
        py += 13;
      }
      const pm = { bank_transfer: 'Bankovní převod', cash: 'Hotově', card: 'Kartou' };
      if (invoice.payment_method) {
        doc.font('Regular').fillColor('#64748b').text('Způsob úhrady', labelX, py);
        doc.font('Bold').fillColor('#0f172a').text(pm[invoice.payment_method] || invoice.payment_method, valueX, py);
        py += 13;
      }
      // Total amount
      doc.font('Regular').fillColor('#64748b').text('K úhradě', labelX, py);
      doc.font('Bold').fontSize(12).fillColor(accent).text(`${fmtNum(invoice.total)} ${invoice.currency === 'CZK' ? 'Kč' : invoice.currency}`, valueX, py - 2);

      // QR code
      if (qrDataUrl) {
        try {
          doc.image(qrDataUrl, margin + payContentW + 14, payTop + 10, { width: 70, height: 70 });
          doc.fontSize(6).font('Bold').fillColor('#94a3b8').text('QR PLATBA', margin + payContentW + 14, payTop + payH - 16, { width: 70, align: 'center' });
        } catch {}
      }

      y = payTop + payH + 16;
    }

    // ─── DATES (gray background row) ────────────────────────
    const datesH = 36;
    doc.save();
    doc.roundedRect(margin, y, pageW - margin, datesH, 4).fill('#f8fafc');
    doc.restore();

    const dateItems = [
      ['DATUM VYSTAVENÍ', fmtDate(invoice.issue_date)],
      ['DÚZP', fmtDate(invoice.supply_date || invoice.issue_date)],
      ['DATUM SPLATNOSTI', fmtDate(invoice.due_date)],
      ['MĚNA', invoice.currency || 'CZK'],
    ];
    const dateColW = (pageW - margin) / dateItems.length;
    dateItems.forEach((d, i) => {
      const dx = margin + i * dateColW + 12;
      doc.fontSize(6.5).font('Bold').fillColor('#94a3b8').text(d[0], dx, y + 8);
      doc.fontSize(9).font('Bold').fillColor('#0f172a').text(d[1], dx, y + 19);
      if (i < dateItems.length - 1) {
        doc.moveTo(margin + (i + 1) * dateColW, y + 6).lineTo(margin + (i + 1) * dateColW, y + datesH - 6).stroke('#e2e8f0');
      }
    });

    y += datesH + 16;

    // ─── ITEMS TABLE ────────────────────────────────────────
    // Header
    doc.save();
    doc.rect(margin, y, pageW - margin, 18).fill('#f8fafc');
    doc.restore();
    doc.moveTo(margin, y).lineTo(pageW, y).stroke('#e2e8f0');

    const thY = y + 5;
    doc.fontSize(7.5).font('Bold').fillColor('#64748b');
    doc.text('Popis', margin + 8, thY, { width: 220 });
    doc.text('Množství', 280, thY, { width: 50, align: 'right' });
    doc.text('Jedn.', 335, thY, { width: 30, align: 'center' });
    doc.text('Cena/ks', 370, thY, { width: 65, align: 'right' });
    doc.text('DPH %', 440, thY, { width: 35, align: 'right' });
    doc.text('Celkem', 480, thY, { width: 75, align: 'right' });
    y += 18;
    doc.moveTo(margin, y).lineTo(pageW, y).lineWidth(1.5).stroke('#e2e8f0');

    // Rows
    doc.lineWidth(0.5);
    (items || []).forEach(item => {
      if (y > 720) { doc.addPage(); y = 40; }
      y += 6;
      doc.fontSize(8.5).font('Regular').fillColor('#0f172a');
      doc.text(item.description || '', margin + 8, y, { width: 220 });
      doc.text(String(item.quantity), 280, y, { width: 50, align: 'right' });
      doc.text(item.unit || 'ks', 335, y, { width: 30, align: 'center' });
      doc.text(fmtNum(item.unit_price), 370, y, { width: 65, align: 'right' });
      doc.text(String(item.tax_rate || 0), 440, y, { width: 35, align: 'right' });
      const lineTotal = item.total_with_tax || item.total || 0;
      doc.text(fmtNum(lineTotal), 480, y, { width: 75, align: 'right' });
      y += 14;
      doc.moveTo(margin, y).lineTo(pageW, y).stroke('#f1f5f9');
    });

    // ─── TOTALS (right-aligned box) ─────────────────────────
    y += 10;
    const totW = 200;
    const totX = pageW - totW;

    doc.fontSize(9).font('Regular').fillColor('#64748b');
    doc.text('Základ:', totX, y);
    doc.font('Bold').fillColor('#0f172a').text(`${fmtNum(invoice.subtotal)} ${invoice.currency}`, totX, y, { width: totW, align: 'right' });
    y += 15;
    doc.font('Regular').fillColor('#64748b').text('DPH:', totX, y);
    doc.font('Bold').fillColor('#0f172a').text(`${fmtNum(invoice.tax_amount)} ${invoice.currency}`, totX, y, { width: totW, align: 'right' });
    y += 15;
    doc.moveTo(totX, y).lineTo(pageW, y).lineWidth(2).stroke('#0f172a');
    y += 8;
    doc.fontSize(11).font('Bold').fillColor('#0f172a');
    doc.text('Celkem', totX, y);
    doc.text(`${fmtNum(invoice.total)} ${invoice.currency}`, totX, y, { width: totW, align: 'right' });

    if (invoice.currency !== 'CZK' && invoice.total_czk) {
      y += 16;
      doc.fontSize(8).font('Regular').fillColor('#94a3b8');
      doc.text(`V CZK: ${fmtNum(invoice.total_czk)} Kč`, totX, y, { width: totW, align: 'right' });
    }

    // ─── NOTE ───────────────────────────────────────────────
    doc.lineWidth(0.5);
    if (invoice.note) {
      y += 24;
      doc.save();
      doc.roundedRect(margin, y, pageW - margin, 40, 4).fill('#f8fafc');
      doc.restore();
      doc.fontSize(7).font('Bold').fillColor('#94a3b8').text('POZNÁMKA', margin + 12, y + 8);
      doc.fontSize(8.5).font('Regular').fillColor('#334155').text(invoice.note, margin + 12, y + 20, { width: pageW - margin - 24 });
    }

    // ─── FOOTER ─────────────────────────────────────────────
    doc.save();
    doc.rect(margin, 780, pageW - margin, 3).fill(accent).opacity(0.3);
    doc.restore();
    doc.fontSize(7).font('Regular').fillColor('#94a3b8')
      .text(`Vygenerováno: ${new Date().toLocaleString('cs-CZ')} | ${co.name || 'ERP System'}`, margin, 788, { align: 'center', width: pageW - margin });

    doc.end();
  });
}

module.exports = { generateInvoicePDF };
