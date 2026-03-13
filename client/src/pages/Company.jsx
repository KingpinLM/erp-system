import React, { useState, useEffect } from 'react';
import { api } from '../api';

const formatTemplates = [
  { value: '{prefix}{sep}{year}{sep}{num}', label: 'Prefix-Rok-Číslo', example: 'FV-2026-001' },
  { value: '{prefix}{sep}{num}{sep}{year}', label: 'Prefix-Číslo-Rok', example: 'FV-001-2026' },
  { value: '{year}{sep}{num}', label: 'Rok-Číslo (bez prefixu)', example: '2026-001' },
  { value: '{prefix}{year}{num}', label: 'PrefixRokČíslo (bez oddělovače)', example: 'FV2026001' },
  { value: '{prefix}{sep}{num}', label: 'Prefix-Číslo (bez roku)', example: 'FV-001' },
];

const separatorOptions = [
  { value: '-', label: 'Pomlčka (-)' },
  { value: '/', label: 'Lomítko (/)' },
  { value: '', label: 'Bez oddělovače' },
];

export default function Company() {
  const [form, setForm] = useState({
    name: 'Rainbow Family Investment', ico: '', dic: '', email: '', phone: '',
    address: '', city: '', zip: '', country: 'CZ', bank_account: '', bank_code: '', iban: '', swift: '',
    invoice_prefix: 'FV', invoice_counter: 1, default_due_days: 14, vat_payer: 0,
    invoice_format: '{prefix}{sep}{year}{sep}{num}', invoice_separator: '-',
    invoice_padding: 3, invoice_year_format: 'full'
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getCompany().then(data => {
      if (data && data.name) setForm(f => ({ ...f, ...data }));
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.updateCompany(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Generate preview of invoice number
  const previewNumber = () => {
    const prefix = form.invoice_prefix || 'FV';
    const sep = form.invoice_separator || '-';
    const padding = form.invoice_padding || 3;
    const fullYear = new Date().getFullYear();
    const year = form.invoice_year_format === 'short' ? String(fullYear).slice(2) : String(fullYear);
    const num = String(form.invoice_counter || 1).padStart(padding, '0');
    const format = form.invoice_format || '{prefix}{sep}{year}{sep}{num}';
    return format.replace(/\{prefix\}/g, prefix).replace(/\{sep\}/g, sep).replace(/\{year\}/g, year).replace(/\{num\}/g, num);
  };

  if (loading) return <div className="loading">Načítání...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nastavení společnosti</h1>
      </div>
      {saved && <div style={{ background: '#d1fae5', color: '#059669', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>Uloženo!</div>}
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Fakturační údaje</div>
          <div className="form-group">
            <label className="form-label">Název společnosti *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">IČO</label><input className="form-input" value={form.ico || ''} onChange={e => setForm(f => ({ ...f, ico: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">DIČ</label><input className="form-input" value={form.dic || ''} onChange={e => setForm(f => ({ ...f, dic: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Adresa</label><input className="form-input" value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Město</label><input className="form-input" value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">PSČ</label><input className="form-input" value={form.zip || ''} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Země</label><input className="form-input" value={form.country || ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Bankovní údaje</div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Číslo účtu</label>
              <input className="form-input" value={form.bank_account || ''} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} placeholder="123456789" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Kód banky</label>
              <select className="form-select" value={form.bank_code || ''} onChange={e => setForm(f => ({ ...f, bank_code: e.target.value }))}>
                <option value="">— Vyberte —</option>
                <option value="0100">0100 — Komerční banka</option>
                <option value="0300">0300 — ČSOB</option>
                <option value="0600">0600 — MONETA Money Bank</option>
                <option value="0710">0710 — Česká národní banka</option>
                <option value="0800">0800 — Česká spořitelna</option>
                <option value="2010">2010 — Fio banka</option>
                <option value="2020">2020 — BANCO</option>
                <option value="2060">2060 — Citfin</option>
                <option value="2070">2070 — Moravský Peněžní Ústav</option>
                <option value="2100">2100 — Hypoteční banka</option>
                <option value="2200">2200 — Creditas</option>
                <option value="2220">2220 — Artesa</option>
                <option value="2240">2240 — Poštová banka</option>
                <option value="2250">2250 — Banka CREDITAS</option>
                <option value="2260">2260 — NEY spořitelní družstvo</option>
                <option value="2275">2275 — Podnikatelská družstevní záložna</option>
                <option value="2600">2600 — Citibank Europe</option>
                <option value="2700">2700 — UniCredit Bank</option>
                <option value="3030">3030 — Air Bank</option>
                <option value="3050">3050 — BNP Paribas Personal Finance</option>
                <option value="3060">3060 — PKO BP S.A.</option>
                <option value="3500">3500 — ING Bank</option>
                <option value="4000">4000 — Expobank CZ</option>
                <option value="4300">4300 — Českomoravská záruční a rozvojová banka</option>
                <option value="5500">5500 — Raiffeisenbank</option>
                <option value="5800">5800 — J&T Banka</option>
                <option value="6000">6000 — PPF banka</option>
                <option value="6100">6100 — Equa bank (Raiffeisenbank)</option>
                <option value="6200">6200 — COMMERZBANK</option>
                <option value="6210">6210 — mBank</option>
                <option value="6300">6300 — BNP Paribas</option>
                <option value="6700">6700 — Všeobecná úverová banka</option>
                <option value="6800">6800 — Sberbank CZ (Česká spořitelna)</option>
                <option value="7910">7910 — Deutsche Bank</option>
                <option value="7940">7940 — Waldviertler Sparkasse Bank</option>
                <option value="7950">7950 — Raiffeisen stavební spořitelna</option>
                <option value="7960">7960 — Českomoravská stavební spořitelna</option>
                <option value="7970">7970 — Modrá pyramida stavební spořitelna</option>
                <option value="7990">7990 — Stavební spořitelna České spořitelny</option>
                <option value="8030">8030 — Volksbank Raiffeisenbank Nordoberpfalz</option>
                <option value="8040">8040 — Oberbank</option>
                <option value="8060">8060 — Stavební spořitelna HYPO</option>
                <option value="8090">8090 — Česká exportní banka</option>
                <option value="8150">8150 — HSBC Continental Europe</option>
                <option value="8200">8200 — PRIVAT BANK</option>
                <option value="8220">8220 — Payment Execution</option>
                <option value="8230">8230 — EEPAYS</option>
                <option value="8240">8240 — Družstevní záložna Kredit</option>
                <option value="8250">8250 — Bank of China</option>
                <option value="8255">8255 — Bank of Communications</option>
                <option value="8265">8265 — Industrial and Commercial Bank of China</option>
                <option value="8270">8270 — Fairplay Pay</option>
                <option value="8280">8280 — B-Efekt</option>
                <option value="8293">8293 — Revolut</option>
                <option value="8299">8299 — Partners banka</option>
              </select>
            </div>
          </div>
          {form.bank_account && form.bank_code && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
              Celé číslo účtu: <strong>{form.bank_account}/{form.bank_code}</strong>
            </div>
          )}
          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group"><label className="form-label">IBAN</label><input className="form-input" value={form.iban || ''} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} placeholder="CZ65 0800 0000 1920 0014 5399" /></div>
            <div className="form-group"><label className="form-label">SWIFT/BIC</label><input className="form-input" value={form.swift || ''} onChange={e => setForm(f => ({ ...f, swift: e.target.value }))} placeholder="GIBACZPX" /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>DPH</div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.vat_payer} onChange={e => setForm(f => ({ ...f, vat_payer: e.target.checked ? 1 : 0 }))} style={{ width: 20, height: 20 }} />
              <div>
                <div style={{ fontWeight: 600 }}>Plátce DPH</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                  {form.vat_payer ? 'Nové faktury budou obsahovat DPH dle zákonných sazeb (0%, 12%, 21%)' : 'Nové faktury budou bez DPH (neplátce)'}
                </div>
              </div>
            </label>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Fakturace</div>
          <div className="form-group">
            <label className="form-label">Výchozí splatnost (dnů)</label>
            <input className="form-input" type="number" min="1" max="365" value={form.default_due_days || 14}
              onChange={e => setForm(f => ({ ...f, default_due_days: parseInt(e.target.value) || 14 }))}
              style={{ maxWidth: 150 }}
            />
            <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>Automaticky se nastaví datum splatnosti při vytvoření faktury</small>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Číselná řada faktur</div>
          <div style={{ background: 'var(--gray-50)', border: '2px solid var(--primary)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Náhled další faktury</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{previewNumber()}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Formát číslování</label>
            <select className="form-select" value={form.invoice_format || '{prefix}{sep}{year}{sep}{num}'} onChange={e => setForm(f => ({ ...f, invoice_format: e.target.value }))}>
              {formatTemplates.map(t => <option key={t.value} value={t.value}>{t.label} ({t.example})</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prefix</label>
              <input className="form-input" value={form.invoice_prefix || ''} onChange={e => setForm(f => ({ ...f, invoice_prefix: e.target.value }))} placeholder="FV" />
            </div>
            <div className="form-group">
              <label className="form-label">Oddělovač</label>
              <select className="form-select" value={form.invoice_separator ?? '-'} onChange={e => setForm(f => ({ ...f, invoice_separator: e.target.value }))}>
                {separatorOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Formát roku</label>
              <select className="form-select" value={form.invoice_year_format || 'full'} onChange={e => setForm(f => ({ ...f, invoice_year_format: e.target.value }))}>
                <option value="full">Celý rok (2026)</option>
                <option value="short">Krátký (26)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Počet číslic</label>
              <select className="form-select" value={form.invoice_padding || 3} onChange={e => setForm(f => ({ ...f, invoice_padding: parseInt(e.target.value) }))}>
                <option value={2}>2 (01, 02...)</option>
                <option value={3}>3 (001, 002...)</option>
                <option value={4}>4 (0001, 0002...)</option>
                <option value={5}>5 (00001, 00002...)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Další číslo</label>
              <input className="form-input" type="number" min="1" value={form.invoice_counter || 1} onChange={e => setForm(f => ({ ...f, invoice_counter: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
        </div>
        <button type="submit" className="btn btn-primary">Uložit nastavení</button>
      </form>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Logo společnosti</div>
        {form.logo && (
          <div style={{ marginBottom: '1rem' }}>
            <img src={form.logo} alt="Logo" style={{ maxWidth: 200, maxHeight: 80, objectFit: 'contain' }} />
            <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={async () => { await api.updateCompany({ ...form, logo: null }); setForm(f => ({ ...f, logo: null })); }}>Odstranit</button>
          </div>
        )}
        <input type="file" accept="image/*" onChange={(e) => {
          const file = e.target.files[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const logo = ev.target.result;
            setForm(f => ({ ...f, logo }));
            await api.updateCompany({ ...form, logo });
            setSaved(true); setTimeout(() => setSaved(false), 3000);
          };
          reader.readAsDataURL(file);
        }} />
        <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem' }}>PNG nebo JPG, max 200px šířka. Zobrazí se na fakturách.</small>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Správa dat</div>
        <a href="/api/backup" className="btn btn-outline" download>Stáhnout zálohu databáze</a>
        <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem' }}>Stáhne kompletní zálohu databáze (SQLite soubor)</small>
      </div>
    </div>
  );
}
