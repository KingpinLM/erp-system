const PDFDocument = require('pdfkit');

function generateInvoicePDF(invoice, company, items) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Faktura ${invoice.invoice_number}`, Author: company?.name || 'ERP System' } });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const co = company || {};
    const isCredit = invoice.invoice_type === 'credit_note';
    const isProforma = invoice.invoice_type === 'proforma';
    const title = isCredit ? 'DOBROPIS' : isProforma ? 'PROFORMA FAKTURA' : 'FAKTURA';

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(title, 40, 40);
    doc.fontSize(12).font('Helvetica').text(invoice.invoice_number, 40, 65, { align: 'left' });

    // Status badge
    const statusMap = { draft: 'Koncept', sent: 'Odesláno', paid: 'Uhrazeno', overdue: 'Po splatnosti', cancelled: 'Stornováno' };
    doc.fontSize(10).text(statusMap[invoice.status] || invoice.status, 400, 45, { align: 'right', width: 155 });

    // Divider
    doc.moveTo(40, 85).lineTo(555, 85).stroke('#e2e8f0');

    // Supplier & Customer columns
    let y = 95;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('DODAVATEL', 40, y);
    doc.text('ODBĚRATEL', 300, y);
    y += 15;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000');
    doc.text(co.name || '—', 40, y);
    doc.text(invoice.client_name || '—', 300, y);
    y += 15;
    doc.font('Helvetica').fontSize(9).fillColor('#334155');

    // Supplier details
    const supplierLines = [];
    if (co.address) supplierLines.push(co.address);
    if (co.city) supplierLines.push(`${co.zip || ''} ${co.city}`.trim());
    if (co.ico) supplierLines.push(`IČ: ${co.ico}`);
    if (co.dic) supplierLines.push(`DIČ: ${co.dic}`);
    supplierLines.forEach(l => { doc.text(l, 40, y); y += 12; });

    // Customer details
    let cy = 125;
    const clientLines = [];
    if (invoice.client_address) clientLines.push(invoice.client_address);
    if (invoice.client_city) clientLines.push(`${invoice.client_zip || ''} ${invoice.client_city}`.trim());
    if (invoice.client_ico) clientLines.push(`IČ: ${invoice.client_ico}`);
    if (invoice.client_dic) clientLines.push(`DIČ: ${invoice.client_dic}`);
    clientLines.forEach(l => { doc.text(l, 300, cy); cy += 12; });

    // Dates section
    y = Math.max(y, cy) + 15;
    doc.moveTo(40, y).lineTo(555, y).stroke('#e2e8f0');
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
      const x = 40 + col * 175;
      const dy = y + row * 24;
      doc.font('Helvetica').text(d[0], x, dy);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(d[1], x, dy + 10);
      doc.fillColor('#64748b');
    });

    y += Math.ceil(dateGrid.length / 3) * 24 + 10;

    // Bank info
    if (co.bank_account || co.iban) {
      doc.moveTo(40, y).lineTo(555, y).stroke('#e2e8f0');
      y += 10;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('PLATEBNÍ ÚDAJE', 40, y);
      y += 14;
      doc.font('Helvetica').fillColor('#334155');
      if (co.bank_account) { doc.text(`Číslo účtu: ${co.bank_account}${co.bank_code ? '/' + co.bank_code : ''}`, 40, y); y += 12; }
      if (co.iban) { doc.text(`IBAN: ${co.iban}`, 40, y); y += 12; }
      if (co.swift) { doc.text(`SWIFT: ${co.swift}`, 40, y); y += 12; }
    }

    y += 10;

    // Items table
    doc.moveTo(40, y).lineTo(555, y).stroke('#e2e8f0');
    y += 8;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b');
    doc.text('Popis', 40, y);
    doc.text('Mn.', 300, y, { width: 40, align: 'right' });
    doc.text('Jed.', 345, y, { width: 30, align: 'center' });
    doc.text('Cena/ks', 380, y, { width: 60, align: 'right' });
    doc.text('DPH %', 445, y, { width: 35, align: 'right' });
    doc.text('Celkem', 485, y, { width: 70, align: 'right' });
    y += 14;
    doc.moveTo(40, y).lineTo(555, y).stroke('#e2e8f0');
    y += 6;

    doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
    (items || []).forEach(item => {
      if (y > 720) { doc.addPage(); y = 40; }
      doc.text(item.description || '', 40, y, { width: 255 });
      doc.text(String(item.quantity), 300, y, { width: 40, align: 'right' });
      doc.text(item.unit || 'ks', 345, y, { width: 30, align: 'center' });
      doc.text(item.unit_price.toFixed(2), 380, y, { width: 60, align: 'right' });
      doc.text(String(item.tax_rate || 0), 445, y, { width: 35, align: 'right' });
      const lineTotal = item.total_with_tax || item.total || 0;
      doc.text(lineTotal.toFixed(2), 485, y, { width: 70, align: 'right' });
      y += 16;
    });

    // Totals
    y += 5;
    doc.moveTo(350, y).lineTo(555, y).stroke('#e2e8f0');
    y += 8;
    doc.fontSize(9);
    doc.font('Helvetica').fillColor('#64748b').text('Základ:', 350, y);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${invoice.subtotal.toFixed(2)} ${invoice.currency}`, 485, y, { width: 70, align: 'right' });
    y += 14;
    doc.font('Helvetica').fillColor('#64748b').text('DPH:', 350, y);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${invoice.tax_amount.toFixed(2)} ${invoice.currency}`, 485, y, { width: 70, align: 'right' });
    y += 14;
    doc.moveTo(350, y).lineTo(555, y).stroke('#0f172a');
    y += 8;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Celkem k úhradě:', 350, y);
    doc.text(`${invoice.total.toFixed(2)} ${invoice.currency}`, 445, y, { width: 110, align: 'right' });

    if (invoice.currency !== 'CZK' && invoice.total_czk) {
      y += 18;
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`(${invoice.total_czk.toFixed(2)} CZK)`, 485, y, { width: 70, align: 'right' });
    }

    // Note
    if (invoice.note) {
      y += 30;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('POZNÁMKA', 40, y);
      y += 12;
      doc.font('Helvetica').fillColor('#334155').text(invoice.note, 40, y, { width: 515 });
    }

    // Footer
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
      .text(`Vygenerováno: ${new Date().toLocaleString('cs-CZ')} | ${co.name || 'ERP System'}`, 40, 780, { align: 'center', width: 515 });

    doc.end();
  });
}

module.exports = { generateInvoicePDF };
