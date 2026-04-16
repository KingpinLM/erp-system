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
    const boxH = 110;
    const midX = margin + (pageW - margin) / 2;

    // Outer border
    doc.roundedRect(margin, boxTop, pageW - margin, boxH, 6).stroke('#e2e8f0');
    // Vertical separator
    doc.moveTo(midX, boxTop + 1).lineTo(midX, boxTop + boxH - 1).stroke('#e2e8f0');

    // Supplier (left)
    let sy = boxTop + 12;
    doc.fontSize(8).font('Bold').fillColor('#64748b').text('DODAVATEL', margin + 16, sy);
    sy += 14;
    doc.fontSize(11).font('Bold').fillColor('#0f172a').text(co.name || '—', margin + 16, sy);
    sy += 16;
    doc.fontSize(8.5).font('Regular').fillColor('#334155');
    if (co.ico) { doc.text(`IČ: ${co.ico}`, margin + 16, sy); sy += 12; }
    if (co.dic) { doc.text(`DIČ: ${co.dic}`, margin + 16, sy); sy += 12; }
    if (co.address) { doc.text(co.address, margin + 16, sy); sy += 12; }
    if (co.city) { doc.text(`${co.city} ${co.zip || ''}`.trim(), margin + 16, sy); sy += 12; }
    if (co.email) { doc.text(co.email, margin + 16, sy); sy += 12; }
    if (co.phone) { doc.text(co.phone, margin + 16, sy); sy += 12; }

    // Customer (right)
    let cy = boxTop + 12;
    doc.fontSize(8).font('Bold').fillColor('#64748b').text('ODBĚRATEL', midX + 16, cy);
    cy += 14;
    doc.fontSize(11).font('Bold').fillColor('#0f172a').text(invoice.client_name || '—', midX + 16, cy);
    cy += 16;
    doc.fontSize(8.5).font('Regular').fillColor('#334155');
    if (invoice.client_ico) { doc.text(`IČ: ${invoice.client_ico}`, midX + 16, cy); cy += 12; }
    if (invoice.client_dic) { doc.text(`DIČ: ${invoice.client_dic}`, midX + 16, cy); cy += 12; }
    if (invoice.client_address) { doc.text(invoice.client_address, midX + 16, cy); cy += 12; }
    if (invoice.client_city) { doc.text(`${invoice.client_city} ${invoice.client_zip || ''}`.trim(), midX + 16, cy); cy += 12; }
    if (invoice.client_email) { doc.text(invoice.client_email, midX + 16, cy); cy += 12; }

    // Adjust box height if content overflows
    const actualBoxH = Math.max(boxH, Math.max(sy, cy) - boxTop + 12);
    if (actualBoxH > boxH) {
      doc.save();
      doc.rect(margin - 1, boxTop - 1, pageW - margin + 2, boxH + 2).fill('#ffffff');
      doc.restore();
      doc.roundedRect(margin, boxTop, pageW - margin, actualBoxH, 6).stroke('#e2e8f0');
      doc.moveTo(midX, boxTop + 1).lineTo(midX, boxTop + actualBoxH - 1).stroke('#e2e8f0');
      // Re-render content (simplified - recalculate)
    }

    y = boxTop + actualBoxH + 16;

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
