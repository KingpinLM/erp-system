const PDFDocument = require('pdfkit');

const layoutConfigs = {
  klasicky: { accent: '#6366f1', accentEnd: '#8b5cf6', headerBg: null, headerText: '#000', headingColor: '#6366f1', totalColor: '#0f172a', tableHeadBg: '#f8fafc', tableHeadColor: '#64748b', divider: '#e2e8f0' },
  minimalisticky: { accent: null, accentEnd: null, headerBg: null, headerText: '#000', headingColor: '#1e293b', totalColor: '#1e293b', tableHeadBg: null, tableHeadColor: '#1e293b', divider: '#cbd5e1' },
  korporatni: { accent: '#0f172a', accentEnd: null, headerBg: '#0f172a', headerText: '#ffffff', headingColor: '#0f172a', totalColor: '#0f172a', tableHeadBg: '#0f172a', tableHeadColor: '#e2e8f0', divider: '#1e293b' },
  elegantni: { accent: '#8b5cf6', accentEnd: '#c4b5fd', headerBg: null, headerText: '#000', headingColor: '#7c3aed', totalColor: '#1e1b4b', tableHeadBg: '#faf5ff', tableHeadColor: '#7c3aed', divider: '#e9d5ff' },
  kompaktni: { accent: '#059669', accentEnd: null, headerBg: null, headerText: '#000', headingColor: '#059669', totalColor: '#0f172a', tableHeadBg: '#f0fdf4', tableHeadColor: '#059669', divider: '#d1fae5' },
};

function generateInvoicePDF(invoice, company, items) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Faktura ${invoice.invoice_number}`, Author: company?.name || 'ERP System' } });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const co = company || {};
    const layout = { ...(layoutConfigs[co.invoice_layout] || layoutConfigs.klasicky) };

    // Override accent colors with custom invoice_color (not for minimalisticky/korporatni)
    if (co.invoice_color && co.invoice_layout !== 'minimalisticky' && co.invoice_layout !== 'korporatni') {
      const hex = co.invoice_color;
      layout.accent = hex;
      layout.accentEnd = null;
      layout.headingColor = hex;
      layout.tableHeadColor = hex;
      // Generate light background from hex
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      const lr = Math.min(255, Math.round(r + (255 - r) * 0.93));
      const lg = Math.min(255, Math.round(g + (255 - g) * 0.93));
      const lb = Math.min(255, Math.round(b + (255 - b) * 0.93));
      layout.tableHeadBg = `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
      const dr = Math.min(255, Math.round(r + (255 - r) * 0.8));
      const dg = Math.min(255, Math.round(g + (255 - g) * 0.8));
      const db = Math.min(255, Math.round(b + (255 - b) * 0.8));
      layout.divider = `#${dr.toString(16).padStart(2,'0')}${dg.toString(16).padStart(2,'0')}${db.toString(16).padStart(2,'0')}`;
    }

    const isCredit = invoice.invoice_type === 'credit_note';
    const isProforma = invoice.invoice_type === 'proforma';
    const title = isCredit ? 'DOBROPIS' : isProforma ? 'PROFORMA FAKTURA' : 'FAKTURA';
    const isKompaktni = co.invoice_layout === 'kompaktni';
    const margin = isKompaktni ? 36 : 40;

    // Accent bar
    if (layout.accent) {
      doc.save();
      doc.rect(margin, 36, 555 - margin, isKompaktni ? 3 : 4).fill(layout.accent);
      doc.restore();
    }

    let headerY = layout.accent ? 46 : 40;

    // Corporate dark header
    if (layout.headerBg) {
      doc.save();
      doc.rect(0, headerY - 6, 612, 55).fill(layout.headerBg);
      doc.restore();
      doc.fontSize(20).font('Helvetica-Bold').fillColor(layout.headerText).text(title, margin, headerY);
      doc.fontSize(12).font('Helvetica').fillColor('#94a3b8').text(invoice.invoice_number, margin, headerY + 25);

      const statusMap = { draft: 'Koncept', sent: 'Odesláno', paid: 'Uhrazeno', overdue: 'Po splatnosti', cancelled: 'Stornováno' };
      doc.fontSize(10).fillColor('#e2e8f0').text(statusMap[invoice.status] || invoice.status, 400, headerY + 5, { align: 'right', width: 155 });
      headerY += 55;
    } else {
      // Standard header
      const titleSize = isKompaktni ? 17 : 20;
      doc.fontSize(titleSize).font('Helvetica-Bold').fillColor(layout.headingColor).text(title, margin, headerY);
      doc.fontSize(12).font('Helvetica').fillColor('#334155').text(invoice.invoice_number, margin, headerY + (isKompaktni ? 22 : 25));

      const statusMap = { draft: 'Koncept', sent: 'Odesláno', paid: 'Uhrazeno', overdue: 'Po splatnosti', cancelled: 'Stornováno' };
      doc.fontSize(10).fillColor('#64748b').text(statusMap[invoice.status] || invoice.status, 400, headerY + 5, { align: 'right', width: 155 });
      headerY += isKompaktni ? 40 : 45;
    }

    // Divider
    doc.moveTo(margin, headerY).lineTo(555, headerY).stroke(layout.divider);

    // Supplier & Customer columns
    let y = headerY + 10;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('DODAVATEL', margin, y);
    doc.text('ODBĚRATEL', 300, y);
    y += 15;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000');
    doc.text(co.name || '—', margin, y);
    doc.text(invoice.client_name || '—', 300, y);
    y += 15;
    doc.font('Helvetica').fontSize(9).fillColor('#334155');

    // Supplier details
    const supplierLines = [];
    if (co.address) supplierLines.push(co.address);
    if (co.city) supplierLines.push(`${co.zip || ''} ${co.city}`.trim());
    if (co.ico) supplierLines.push(`IČ: ${co.ico}`);
    if (co.dic) supplierLines.push(`DIČ: ${co.dic}`);
    supplierLines.forEach(l => { doc.text(l, margin, y); y += 12; });

    // Customer details
    let cy = headerY + 40;
    const clientLines = [];
    if (invoice.client_address) clientLines.push(invoice.client_address);
    if (invoice.client_city) clientLines.push(`${invoice.client_zip || ''} ${invoice.client_city}`.trim());
    if (invoice.client_ico) clientLines.push(`IČ: ${invoice.client_ico}`);
    if (invoice.client_dic) clientLines.push(`DIČ: ${invoice.client_dic}`);
    clientLines.forEach(l => { doc.text(l, 300, cy); cy += 12; });

    // Dates section
    y = Math.max(y, cy) + 15;
    doc.moveTo(margin, y).lineTo(555, y).stroke(layout.divider);
    y += 10;

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('cs-CZ') : '—';
    const dateGrid = [
      ['Datum vystavení', fmtDate(invoice.issue_date)],
      ['Datum splatnosti', fmtDate(invoice.due_date)],
      ['DUZP', fmtDate(invoice.supply_date || invoice.issue_date)],
    ];
    if (invoice.paid_date) dateGrid.push(['Datum úhrady', fmtDate(invoice.paid_date)]);
    if (invoice.variable_symbol) dateGrid.push(['Variabilní symbol', invoice.variable_symbol]);
    if (invoice.payment_method) {
      const pm = { bank_transfer: 'Bankovní převod', cash: 'Hotově', card: 'Kartou' };
      dateGrid.push(['Způsob úhrady', pm[invoice.payment_method] || invoice.payment_method]);
    }

    doc.fontSize(8).fillColor('#64748b');
    dateGrid.forEach((d, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + col * 175;
      const dy = y + row * 24;
      doc.font('Helvetica').text(d[0], x, dy);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(d[1], x, dy + 10);
      doc.fillColor('#64748b');
    });

    y += Math.ceil(dateGrid.length / 3) * 24 + 10;

    // Bank info
    if (co.bank_account || co.iban) {
      doc.moveTo(margin, y).lineTo(555, y).stroke(layout.divider);
      y += 10;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('PLATEBNÍ ÚDAJE', margin, y);
      y += 14;
      doc.font('Helvetica').fillColor('#334155');
      if (co.bank_account) { doc.text(`Číslo účtu: ${co.bank_account}${co.bank_code ? '/' + co.bank_code : ''}`, margin, y); y += 12; }
      if (co.iban) { doc.text(`IBAN: ${co.iban}`, margin, y); y += 12; }
      if (co.swift) { doc.text(`SWIFT: ${co.swift}`, margin, y); y += 12; }
    }

    y += 10;

    // Items table header
    doc.moveTo(margin, y).lineTo(555, y).stroke(layout.divider);
    y += 2;

    // Table header background
    if (layout.tableHeadBg) {
      doc.save();
      doc.rect(margin, y, 555 - margin, 16).fill(layout.tableHeadBg);
      doc.restore();
    }

    y += 4;
    const thFontSize = isKompaktni ? 7 : 8;
    doc.fontSize(thFontSize).font('Helvetica-Bold').fillColor(layout.tableHeadColor);
    doc.text('Popis', margin + 4, y);
    doc.text('Mn.', 300, y, { width: 40, align: 'right' });
    doc.text('Jed.', 345, y, { width: 30, align: 'center' });
    doc.text('Cena/ks', 380, y, { width: 60, align: 'right' });
    doc.text('DPH %', 445, y, { width: 35, align: 'right' });
    doc.text('Celkem', 485, y, { width: 70, align: 'right' });
    y += 14;
    doc.moveTo(margin, y).lineTo(555, y).stroke(layout.divider);
    y += 6;

    // Korporatni: render payment sidebar alongside items
    const isKorporatni = co.invoice_layout === 'korporatni';
    const itemsRight = isKorporatni && (co.bank_account || co.iban) ? 410 : 555;

    const rowFontSize = isKompaktni ? 8 : 9;
    const rowHeight = isKompaktni ? 14 : 16;
    const itemsStartY = y;

    // Items table columns adjust for korporatni sidebar
    doc.font('Helvetica').fontSize(rowFontSize).fillColor('#0f172a');
    (items || []).forEach(item => {
      if (y > 720) { doc.addPage(); y = 40; }
      const descW = isKorporatni ? 150 : 250;
      doc.text(item.description || '', margin + 4, y, { width: descW });
      const qCol = isKorporatni ? 210 : 300;
      doc.text(String(item.quantity), qCol, y, { width: 40, align: 'right' });
      doc.text(item.unit || 'ks', qCol + 45, y, { width: 30, align: 'center' });
      doc.text(item.unit_price.toFixed(2), qCol + 80, y, { width: 60, align: 'right' });
      if (!isKorporatni) {
        doc.text(String(item.tax_rate || 0), 445, y, { width: 35, align: 'right' });
      }
      const lineTotal = item.total_with_tax || item.total || 0;
      const totalCol = isKorporatni ? 350 : 485;
      doc.text(lineTotal.toFixed(2), totalCol, y, { width: isKorporatni ? 50 : 70, align: 'right' });
      y += rowHeight;
    });

    // Korporatni sidebar
    if (isKorporatni && (co.bank_account || co.iban)) {
      const sx = 420;
      let sy = itemsStartY - 20;
      doc.moveTo(sx - 8, sy).lineTo(sx - 8, y + 60).stroke('#334155');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('PLATEBNÍ ÚDAJE', sx, sy);
      sy += 14;
      doc.font('Helvetica').fontSize(8).fillColor('#334155');
      if (co.bank_account) { doc.text(`Účet: ${co.bank_account}${co.bank_code ? '/' + co.bank_code : ''}`, sx, sy); sy += 11; }
      if (co.iban) { doc.text(`IBAN: ${co.iban}`, sx, sy); sy += 11; }
      if (co.swift) { doc.text(`SWIFT: ${co.swift}`, sx, sy); sy += 11; }
      if (invoice.variable_symbol) { doc.text(`VS: ${invoice.variable_symbol}`, sx, sy); sy += 11; }
      sy += 6;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('K úhradě:', sx, sy);
      sy += 12;
      doc.fontSize(12).text(`${invoice.total.toFixed(2)} ${invoice.currency}`, sx, sy);
    }

    // Totals
    y += 5;
    const totalsLeft = isKorporatni ? 220 : 350;
    doc.moveTo(totalsLeft, y).lineTo(itemsRight, y).stroke(layout.divider);
    y += 8;
    doc.fontSize(9);
    doc.font('Helvetica').fillColor('#64748b').text('Základ:', totalsLeft, y);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${invoice.subtotal.toFixed(2)} ${invoice.currency}`, itemsRight - 70, y, { width: 70, align: 'right' });
    y += 14;
    doc.font('Helvetica').fillColor('#64748b').text('DPH:', totalsLeft, y);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${invoice.tax_amount.toFixed(2)} ${invoice.currency}`, itemsRight - 70, y, { width: 70, align: 'right' });
    y += 14;
    doc.moveTo(totalsLeft, y).lineTo(itemsRight, y).stroke(layout.totalColor);
    y += 8;
    doc.fontSize(12).font('Helvetica-Bold').fillColor(layout.totalColor);
    doc.text('Celkem k úhradě:', totalsLeft, y);
    doc.text(`${invoice.total.toFixed(2)} ${invoice.currency}`, itemsRight - 110, y, { width: 110, align: 'right' });

    if (invoice.currency !== 'CZK' && invoice.total_czk) {
      y += 18;
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`(${invoice.total_czk.toFixed(2)} CZK)`, 485, y, { width: 70, align: 'right' });
    }

    // Note
    if (invoice.note) {
      y += 30;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('POZNÁMKA', margin, y);
      y += 12;
      doc.font('Helvetica').fillColor('#334155').text(invoice.note, margin, y, { width: 515 });
    }

    // Footer accent line
    if (layout.accent) {
      doc.save();
      doc.rect(margin, 770, 555 - margin, 2).fill(layout.accent).opacity(0.4);
      doc.restore();
    }

    // Footer
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
      .text(`Vygenerováno: ${new Date().toLocaleString('cs-CZ')} | ${co.name || 'ERP System'}`, margin, 780, { align: 'center', width: 515 });

    doc.end();
  });
}

module.exports = { generateInvoicePDF };
