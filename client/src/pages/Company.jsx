import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const invoiceLayouts = [
  {
    key: 'klasicky',
    name: 'Klasický',
    desc: 'Standardní moderní layout s gradientovým pruhem a přehledným rozložením.',
    accent: '#6366f1',
    preview: { headerAlign: 'left-right', accentType: 'gradient-bar', partyStyle: 'grid-border', totalsStyle: 'right-aligned' }
  },
  {
    key: 'minimalisticky',
    name: 'Minimalistický',
    desc: 'Čistý design s maximem bílého prostoru. Žádné barvy, pouze typografie.',
    accent: '#1e293b',
    preview: { headerAlign: 'left-only', accentType: 'none', partyStyle: 'simple', totalsStyle: 'right-aligned' }
  },
  {
    key: 'korporatni',
    name: 'Korporátní',
    desc: 'Profesionální firemní styl s tmavou hlavičkou a výrazným logem.',
    accent: '#0f172a',
    preview: { headerAlign: 'dark-header', accentType: 'full-header', partyStyle: 'boxed', totalsStyle: 'highlighted' }
  },
  {
    key: 'elegantni',
    name: 'Elegantní',
    desc: 'Jemné barvy, zaoblené rohy a rafinovaná typografie pro prémiový dojem.',
    accent: '#8b5cf6',
    preview: { headerAlign: 'center', accentType: 'subtle-line', partyStyle: 'card', totalsStyle: 'card' }
  },
  {
    key: 'kompaktni',
    name: 'Kompaktní',
    desc: 'Úsporné rozložení pro maximum informací na jedné stránce.',
    accent: '#059669',
    preview: { headerAlign: 'inline', accentType: 'left-border', partyStyle: 'inline', totalsStyle: 'compact' }
  },
];

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
  const [hoveredLayout, setHoveredLayout] = useState(null);
  const hoverRef = useRef(null);

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
        <div className="card" style={{ position: 'relative' }}>
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>Vzhled faktury</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1.25rem' }}>Zvolte layout, který se použije při zobrazení a tisku faktur. Najeďte myší pro náhled.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {invoiceLayouts.map(layout => {
              const selected = (form.invoice_layout || 'klasicky') === layout.key;
              const hovered = hoveredLayout === layout.key;
              return (
                <div key={layout.key}
                  onClick={() => setForm(f => ({ ...f, invoice_layout: layout.key }))}
                  onMouseEnter={(e) => { setHoveredLayout(layout.key); hoverRef.current = e.currentTarget; }}
                  onMouseLeave={() => setHoveredLayout(null)}
                  style={{
                    border: selected ? `2px solid ${layout.accent}` : hovered ? `2px solid ${layout.accent}80` : '2px solid var(--gray-200)',
                    borderRadius: 'var(--radius-lg)', padding: 0, cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden',
                    boxShadow: selected ? `0 4px 16px ${layout.accent}20` : hovered ? `0 4px 12px ${layout.accent}15` : 'none',
                    transform: selected ? 'translateY(-2px)' : hovered ? 'translateY(-3px) scale(1.02)' : 'none',
                  }}
                >
                  {/* Mini preview */}
                  <div style={{ padding: '12px 14px 10px', background: selected ? `${layout.accent}08` : hovered ? `${layout.accent}05` : 'var(--gray-50)', borderBottom: `1px solid ${selected ? layout.accent + '30' : 'var(--gray-200)'}`, transition: 'background 0.2s' }}>
                    {layout.preview.accentType === 'gradient-bar' && (
                      <div style={{ height: 3, background: `linear-gradient(90deg, ${layout.accent}, #8b5cf6)`, borderRadius: 2, marginBottom: 8 }} />
                    )}
                    {layout.preview.accentType === 'full-header' && (
                      <div style={{ height: 20, background: layout.accent, borderRadius: 4, marginBottom: 8, display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                        <div style={{ width: 24, height: 6, background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
                        <div style={{ marginLeft: 'auto', width: 16, height: 6, background: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
                      </div>
                    )}
                    {layout.preview.accentType === 'subtle-line' && (
                      <div style={{ height: 1.5, background: layout.accent, opacity: 0.3, marginBottom: 8 }} />
                    )}
                    {layout.preview.accentType === 'left-border' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ width: 3, background: layout.accent, borderRadius: 2, alignSelf: 'stretch' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ width: 32, height: 5, background: 'var(--gray-300)', borderRadius: 2 }} />
                            <div style={{ width: 20, height: 5, background: 'var(--gray-200)', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    )}
                    {layout.preview.accentType !== 'left-border' && (
                      <div style={{ display: 'flex', justifyContent: layout.preview.headerAlign === 'center' ? 'center' : 'space-between', marginBottom: 6 }}>
                        <div style={{ width: 32, height: 5, background: 'var(--gray-300)', borderRadius: 2 }} />
                        {layout.preview.headerAlign !== 'center' && layout.preview.headerAlign !== 'left-only' && (
                          <div style={{ width: 20, height: 5, background: 'var(--gray-200)', borderRadius: 2 }} />
                        )}
                      </div>
                    )}
                    {/* Mini party boxes */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                      <div style={{
                        flex: 1, height: 16, borderRadius: 3,
                        background: layout.preview.partyStyle === 'boxed' ? 'var(--gray-200)' : 'transparent',
                        border: layout.preview.partyStyle === 'card' ? '1px solid var(--gray-200)' : layout.preview.partyStyle === 'grid-border' ? '1px solid var(--gray-200)' : 'none',
                      }}>
                        <div style={{ width: '60%', height: 3, background: 'var(--gray-300)', borderRadius: 1, margin: '4px 4px' }} />
                        <div style={{ width: '40%', height: 2, background: 'var(--gray-200)', borderRadius: 1, margin: '2px 4px' }} />
                      </div>
                      <div style={{
                        flex: 1, height: 16, borderRadius: 3,
                        background: layout.preview.partyStyle === 'boxed' ? 'var(--gray-200)' : 'transparent',
                        border: layout.preview.partyStyle === 'card' ? '1px solid var(--gray-200)' : layout.preview.partyStyle === 'grid-border' ? '1px solid var(--gray-200)' : 'none',
                      }}>
                        <div style={{ width: '50%', height: 3, background: 'var(--gray-300)', borderRadius: 1, margin: '4px 4px' }} />
                        <div style={{ width: '35%', height: 2, background: 'var(--gray-200)', borderRadius: 1, margin: '2px 4px' }} />
                      </div>
                    </div>
                    {/* Mini table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ height: 3, background: 'var(--gray-200)', borderRadius: 1 }} />
                      <div style={{ height: 2, background: 'var(--gray-100)', borderRadius: 1, width: '90%' }} />
                      <div style={{ height: 2, background: 'var(--gray-100)', borderRadius: 1, width: '75%' }} />
                    </div>
                    {/* Mini total */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <div style={{
                        width: layout.preview.totalsStyle === 'compact' ? '35%' : layout.preview.totalsStyle === 'card' ? '45%' : '40%',
                        height: layout.preview.totalsStyle === 'highlighted' ? 8 : 5,
                        background: layout.preview.totalsStyle === 'highlighted' ? layout.accent : 'var(--gray-300)',
                        borderRadius: 2,
                        opacity: layout.preview.totalsStyle === 'highlighted' ? 0.7 : 1
                      }} />
                    </div>
                  </div>
                  {/* Label */}
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: layout.accent, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-900)' }}>{layout.name}</span>
                      {selected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={layout.accent} style={{ marginLeft: 'auto' }}>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>{layout.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Large hover preview popup */}
          {hoveredLayout && (() => {
            const layout = invoiceLayouts.find(l => l.key === hoveredLayout);
            if (!layout) return null;
            const isKorporatni = layout.key === 'korporatni';
            const isMinimal = layout.key === 'minimalisticky';
            const isElegant = layout.key === 'elegantni';
            const isCompact = layout.key === 'kompaktni';
            const bg = isKorporatni ? '#0f172a' : 'white';
            const textColor = isKorporatni ? '#e2e8f0' : '#1e293b';
            const mutedColor = isKorporatni ? '#94a3b8' : '#94a3b8';
            const borderColor = isElegant ? '#e9d5ff' : isMinimal ? '#cbd5e1' : '#e2e8f0';
            const accentColor = layout.accent;
            const pad = isCompact ? 14 : 20;
            return (
              <div style={{
                position: 'absolute', right: -340, top: 0, width: 320,
                background: 'white', borderRadius: 'var(--radius-lg)',
                border: `2px solid ${accentColor}40`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
                zIndex: 50, overflow: 'hidden', pointerEvents: 'none',
                animation: 'fadeIn 0.2s ease-out',
              }}>
                <div style={{ padding: `4px ${pad}px 0`, fontSize: '0.65rem', fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--gray-50)', paddingTop: 8, paddingBottom: 6, borderBottom: `1px solid ${borderColor}` }}>
                  Náhled: {layout.name}
                </div>
                <div style={{ padding: pad, background: bg, fontSize: isCompact ? 9 : 10 }}>
                  {/* Accent bar */}
                  {!isKorporatni && !isMinimal && (
                    <div style={{ height: isElegant ? 1.5 : isCompact ? 2 : 3, background: isElegant ? `linear-gradient(90deg, #c4b5fd, ${accentColor}, #c4b5fd)` : isCompact ? accentColor : `linear-gradient(90deg, ${accentColor}, #8b5cf6)`, borderRadius: isCompact ? 0 : 2, marginBottom: isCompact ? 8 : 12 }} />
                  )}
                  {/* Corporate dark header */}
                  {isKorporatni && (
                    <div style={{ background: '#0f172a', margin: `0 -${pad}px`, padding: `10px ${pad}px 8px`, marginBottom: 10, marginTop: -pad }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 7, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Faktura</div>
                          <div style={{ fontSize: isCompact ? 13 : 16, fontWeight: 800, color: '#ffffff' }}>FV-2026-001</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ width: 50, height: 14, background: 'rgba(255,255,255,0.15)', borderRadius: 3, marginBottom: 3 }} />
                          <div style={{ fontSize: 7, color: '#94a3b8' }}>Firma s.r.o.</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Standard header */}
                  {!isKorporatni && (
                    <div style={{ display: 'flex', justifyContent: isElegant ? 'center' : 'space-between', alignItems: isElegant ? 'center' : 'flex-start', marginBottom: isCompact ? 8 : 12, flexDirection: isElegant ? 'column' : 'row' }}>
                      <div style={{ textAlign: isElegant ? 'center' : 'left' }}>
                        <div style={{ fontSize: isMinimal ? 6 : 7, fontWeight: isMinimal ? 600 : 800, color: isMinimal ? '#1e293b' : accentColor, textTransform: 'uppercase', letterSpacing: isMinimal ? '0.15em' : '0.08em' }}>Faktura</div>
                        <div style={{ fontSize: isElegant ? 18 : isCompact ? 13 : 16, fontWeight: isElegant ? 300 : isMinimal ? 400 : 800, color: isElegant ? '#1e1b4b' : textColor }}>FV-2026-001</div>
                      </div>
                      {!isElegant && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: isCompact ? 8 : 10, fontWeight: 700, color: textColor }}>{form.name || 'Firma s.r.o.'}</div>
                          <div style={{ fontSize: 7, color: mutedColor }}>IČ: 12345678</div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Parties */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: isCompact ? 6 : 10,
                    border: `1px solid ${borderColor}`, borderRadius: isElegant ? 10 : isMinimal ? 0 : isCompact ? 4 : 6,
                    borderLeft: isMinimal ? 'none' : undefined, borderRight: isMinimal ? 'none' : undefined,
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: isCompact ? '5px 7px' : '7px 9px', borderRight: isMinimal ? 'none' : `1px solid ${borderColor}` }}>
                      <div style={{ fontSize: 6, fontWeight: 700, color: isElegant ? accentColor : mutedColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Dodavatel</div>
                      <div style={{ fontSize: isCompact ? 7 : 8, fontWeight: 700, color: textColor }}>{form.name || 'Firma s.r.o.'}</div>
                      <div style={{ fontSize: 6, color: mutedColor }}>IČ: 12345678</div>
                    </div>
                    <div style={{ padding: isCompact ? '5px 7px' : '7px 9px' }}>
                      <div style={{ fontSize: 6, fontWeight: 700, color: isElegant ? accentColor : mutedColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Odběratel</div>
                      <div style={{ fontSize: isCompact ? 7 : 8, fontWeight: 700, color: textColor }}>Klient a.s.</div>
                      <div style={{ fontSize: 6, color: mutedColor }}>IČ: 87654321</div>
                    </div>
                  </div>
                  {/* Items table */}
                  <div style={{ marginBottom: isCompact ? 6 : 10 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', padding: '3px 5px', fontSize: 6, fontWeight: 700,
                      background: isKorporatni ? '#0f172a' : isElegant ? '#faf5ff' : isCompact ? '#f0fdf4' : '#f8fafc',
                      color: isKorporatni ? '#e2e8f0' : isElegant ? '#7c3aed' : isMinimal ? '#1e293b' : isCompact ? '#059669' : '#94a3b8',
                      borderBottom: isMinimal ? '1px solid #1e293b' : `1px solid ${borderColor}`, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      <span>Popis</span><span>Celkem</span>
                    </div>
                    {[{ name: 'Webový design', price: '25 000' }, { name: 'SEO optimalizace', price: '8 500' }, { name: 'Hosting 12 měs.', price: '3 600' }].map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 5px', fontSize: isCompact ? 6 : 7, color: textColor === '#e2e8f0' ? '#cbd5e1' : '#475569', borderBottom: `1px solid ${isElegant ? '#f3e8ff' : isKorporatni ? '#1e293b' : '#f1f5f9'}` }}>
                        <span>{item.name}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.price} Kč</span>
                      </div>
                    ))}
                  </div>
                  {/* Totals */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '55%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6, color: mutedColor, marginBottom: 2 }}>
                        <span>Základ</span><span>37 100 Kč</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6, color: mutedColor, marginBottom: 3 }}>
                        <span>DPH 21%</span><span>7 791 Kč</span>
                      </div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', fontSize: isCompact ? 9 : 11, fontWeight: 800,
                        color: isElegant ? '#1e1b4b' : isKorporatni ? '#ffffff' : textColor,
                        borderTop: `2px solid ${isElegant ? '#7c3aed' : isKorporatni ? '#e2e8f0' : isMinimal ? '#1e293b' : textColor}`,
                        paddingTop: 3, marginTop: 2,
                      }}>
                        <span>Celkem</span><span>44 891 Kč</span>
                      </div>
                    </div>
                  </div>
                  {/* Bottom accent */}
                  {!isKorporatni && !isMinimal && (
                    <div style={{ height: isElegant ? 1 : 2, background: isCompact ? accentColor : isElegant ? `linear-gradient(90deg, #c4b5fd, ${accentColor}, #c4b5fd)` : `linear-gradient(90deg, ${accentColor}, #8b5cf6)`, borderRadius: 1, marginTop: isCompact ? 8 : 12, opacity: 0.5 }} />
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        <button type="submit" className="btn btn-primary">Uložit nastavení</button>
      </form>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Logo společnosti</div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{
            width: 200, height: 100, borderRadius: 'var(--radius)', border: '2px solid var(--gray-200)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            background: form.logo ? 'white' : 'var(--gray-50)', transition: 'all 0.2s ease'
          }}>
            {form.logo ? (
              <img src={form.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                <div style={{ fontSize: '0.7rem', marginTop: 4 }}>Bez loga</div>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              className="logo-upload-area"
              onClick={() => document.getElementById('logo-upload-input').click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-50)'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = '';
                const file = e.dataTransfer.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const logo = ev.target.result;
                  setForm(f => ({ ...f, logo }));
                  await api.updateCompany({ ...form, logo });
                  setSaved(true); setTimeout(() => setSaved(false), 3000);
                };
                reader.readAsDataURL(file);
              }}
            >
              <input id="logo-upload-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
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
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-700)' }}>Nahrát logo</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 2 }}>Přetáhněte soubor nebo klikněte</div>
            </div>
            {form.logo && (
              <button className="btn btn-outline btn-sm" style={{ marginTop: '0.75rem' }} onClick={async () => { await api.updateCompany({ ...form, logo: null }); setForm(f => ({ ...f, logo: null })); }}>
                Odstranit logo
              </button>
            )}
            <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem' }}>PNG nebo JPG, max 200px šířka. Zobrazí se na fakturách.</small>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Správa dat</div>
        <a href="/api/backup" className="btn btn-outline" download>Stáhnout zálohu databáze</a>
        <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem' }}>Stáhne kompletní zálohu databáze (SQLite soubor)</small>
      </div>
    </div>
  );
}
