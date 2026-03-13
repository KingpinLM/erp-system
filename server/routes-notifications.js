const express = require('express');
const db = require('./database');
const { authenticate, authorize, tenantScope } = require('./auth');
const { generateInvoicePDF } = require('./pdf-generator');
const router = express.Router();
const tenanted = [authenticate, tenantScope];

// Notification settings (stored in company table extension)
// For now we use a simple nodemailer-compatible approach
// SMTP settings come from environment variables:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

let transporter = null;

function getMailer() {
  if (transporter) return transporter;
  try {
    const nodemailer = require('nodemailer');
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  } catch {
    return null;
  }
}

// Send invoice by email
router.post('/api/invoices/:id/send-email', ...tenanted, authorize('admin', 'accountant'), async (req, res) => {
  const { to, subject, message } = req.body;
  const invoice = db.prepare(`SELECT i.*, c.name as client_name, c.ico as client_ico, c.dic as client_dic,
    c.address as client_address, c.city as client_city, c.zip as client_zip, c.email as client_email
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ? AND i.tenant_id = ?`).get(req.params.id, req.tenant_id);
  if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });

  const mailer = getMailer();
  if (!mailer) {
    return res.status(400).json({ error: 'Email není nakonfigurován. Nastavte SMTP_HOST, SMTP_USER, SMTP_PASS v proměnných prostředí.' });
  }

  const company = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);

  try {
    const pdfBuffer = await generateInvoicePDF(invoice, company, items);
    const recipientEmail = to || invoice.client_email;
    if (!recipientEmail) return res.status(400).json({ error: 'Klient nemá nastavený email' });

    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject: subject || `Faktura ${invoice.invoice_number} - ${company?.name || ''}`,
      text: message || `Dobrý den,\n\nv příloze zasíláme fakturu ${invoice.invoice_number}.\n\nS pozdravem,\n${company?.name || ''}`,
      html: `<p>Dobrý den,</p><p>${message || `v příloze zasíláme fakturu <strong>${invoice.invoice_number}</strong>.`}</p><p>S pozdravem,<br/>${company?.name || ''}</p>`,
      attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBuffer }],
    });

    // Update invoice status to sent if draft
    if (invoice.status === 'draft') {
      db.prepare("UPDATE invoices SET status = 'sent', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    }

    db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'email', 'invoice', ?, ?)")
      .run(req.tenant_id, req.user.id, req.params.id, `Email odeslán na ${recipientEmail}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('Email error:', e);
    res.status(500).json({ error: 'Chyba při odesílání emailu: ' + e.message });
  }
});

// Check email configuration
router.get('/api/email/status', ...tenanted, authorize('admin'), (req, res) => {
  const configured = !!process.env.SMTP_HOST;
  res.json({
    configured,
    host: process.env.SMTP_HOST || null,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
  });
});

// Send payment reminder
router.post('/api/invoices/:id/send-reminder', ...tenanted, authorize('admin', 'accountant'), async (req, res) => {
  const invoice = db.prepare(`SELECT i.*, c.name as client_name, c.email as client_email
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ? AND i.tenant_id = ?`).get(req.params.id, req.tenant_id);
  if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });

  const mailer = getMailer();
  if (!mailer) return res.status(400).json({ error: 'Email není nakonfigurován' });
  if (!invoice.client_email) return res.status(400).json({ error: 'Klient nemá email' });

  const company = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const daysPast = Math.floor((Date.now() - new Date(invoice.due_date)) / 86400000);
  const remaining = invoice.total - (invoice.paid_amount || 0);

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: invoice.client_email,
      subject: `Upomínka - faktura ${invoice.invoice_number} po splatnosti`,
      html: `<p>Dobrý den,</p>
<p>dovolujeme si Vás upozornit na neuhrazenou fakturu:</p>
<ul>
<li><strong>Číslo faktury:</strong> ${invoice.invoice_number}</li>
<li><strong>Splatnost:</strong> ${new Date(invoice.due_date).toLocaleDateString('cs-CZ')}</li>
<li><strong>Dní po splatnosti:</strong> ${daysPast}</li>
<li><strong>Zbývá uhradit:</strong> ${remaining.toFixed(2)} ${invoice.currency}</li>
${invoice.variable_symbol ? `<li><strong>VS:</strong> ${invoice.variable_symbol}</li>` : ''}
</ul>
<p>Pokud jste platbu již odeslali, považujte tento email za bezpředmětný.</p>
<p>S pozdravem,<br/>${company?.name || ''}</p>`,
    });

    db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'reminder', 'invoice', ?, ?)")
      .run(req.tenant_id, req.user.id, req.params.id, `Upomínka odeslána na ${invoice.client_email}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Chyba při odesílání upomínky: ' + e.message });
  }
});

module.exports = router;
