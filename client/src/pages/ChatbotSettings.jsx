import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';

// ── Fine-grained subcategory classification ──
// Each rule: { key, label, icon, keywords[] } — matched against item keywords + question_cs
const SECTIONS = [
  {
    key: 'navigation',
    label: 'Navigace',
    icon: '🧭',
    desc: 'Kde najdu jednotlivé sekce a funkce systému',
    groups: [
      { key: 'nav-finance', label: 'Finance', icon: '💳', match: ['faktur', 'klient', 'evidence', 'opakovan', 'recurring'] },
      { key: 'nav-accounting', label: 'Účetnictví', icon: '📒', match: ['účetnictví', 'banka', 'dph', 'vat', 'měn', 'currencies'] },
      { key: 'nav-admin', label: 'Správa', icon: '🔧', match: ['společnost', 'company', 'uživatel', 'users', 'profil', 'heslo'] },
      { key: 'nav-general', label: 'Obecné', icon: '🏠', match: ['dashboard', 'přehled', 'home', 'zákazní'] },
    ],
  },
  {
    key: 'invoices',
    label: 'Faktury',
    icon: '📄',
    desc: 'Vytváření, úprava, odesílání a správa faktur',
    groups: [
      { key: 'inv-create', label: 'Vytváření a úprava', icon: '✏️', match: ['vytvořit faktur', 'nová faktur', 'upravit', 'editovat', 'smazat', 'duplikovat', 'kopír', 'proforma', 'zálohov'] },
      { key: 'inv-status', label: 'Stav a odesílání', icon: '📤', match: ['stav faktur', 'status', 'email', 'odeslat', 'upomínk', 'reminder', 'hromadně', 'bulk', 'storno'] },
      { key: 'inv-docs', label: 'Dokumenty a export', icon: '📑', match: ['pdf', 'tisk', 'print', 'isdoc', 'xml'] },
      { key: 'inv-numbering', label: 'Číslování a nastavení', icon: '🔢', match: ['číslo faktur', 'číselná řad', 'splatnost', 'due days', 'vzhled', 'layout', 'šablona', 'poznámk', 'note'] },
      { key: 'inv-discount', label: 'Slevy a speciální případy', icon: '🏷️', match: ['slev', 'discount', 'skonto', 'dobropis', 'credit note', 'zaokrouhl', 'přeplatek', 'dobírk'] },
    ],
  },
  {
    key: 'payments',
    label: 'Platby a banka',
    icon: '🏦',
    desc: 'Platby, bankovní transakce, párování a importy',
    groups: [
      { key: 'pay-record', label: 'Záznam plateb', icon: '💰', match: ['zaplatit', 'platba', 'payment', 'částečná', 'partial', 'splátk', 'qr'] },
      { key: 'pay-bank', label: 'Bankovní operace', icon: '🏧', match: ['import', 'výpis', 'csv', 'párování', 'match', 'rekonciliac', 'nespárovan', 'bankovní účet'] },
      { key: 'pay-terms', label: 'Platební podmínky', icon: '📋', match: ['platební podmínk', 'payment terms', 'penále', 'úroky', 'penalty', 'způsob platby'] },
    ],
  },
  {
    key: 'clients',
    label: 'Klienti',
    icon: '👥',
    desc: 'Správa klientů, zákazníků a kontaktů',
    groups: [],  // flat — too few items for subgroups
  },
  {
    key: 'accounting',
    label: 'Účetnictví',
    icon: '📊',
    desc: 'Účtová osnova, deník, hlavní kniha a výkazy',
    groups: [
      { key: 'acc-core', label: 'Základní účetnictví', icon: '📓', match: ['účtová osnov', 'chart of accounts', 'deník', 'journal', 'hlavní knih', 'ledger', 'zaúčtovat', 'post'] },
      { key: 'acc-reports', label: 'Výkazy a přehledy', icon: '📈', match: ['výkaz', 'report', 'výsledovk', 'rozvaha', 'balance sheet', 'statistik', 'přehled', 'analytics', 'měsíční'] },
      { key: 'acc-periods', label: 'Období a uzávěrky', icon: '📅', match: ['období', 'fiscal', 'uzávěrk'] },
    ],
  },
  {
    key: 'vat',
    label: 'DPH a daně',
    icon: '🧾',
    desc: 'Sazby DPH, přiznání, přenesení daňové povinnosti',
    groups: [],
  },
  {
    key: 'settings',
    label: 'Nastavení a správa',
    icon: '⚙️',
    desc: 'Společnost, uživatelé, role, zálohy a zabezpečení',
    groups: [
      { key: 'set-company', label: 'Společnost', icon: '🏢', match: ['logo', 'bankovní spojení', 'bank details', 'záloha', 'backup', 'migrace', 'přenos dat'] },
      { key: 'set-users', label: 'Uživatelé a role', icon: '👤', match: ['role', 'oprávněn', 'přidat uživatel', 'pozvánk', 'invite', 'změnit heslo', 'skupin'] },
      { key: 'set-security', label: 'Zabezpečení a systém', icon: '🔒', match: ['bezpečnost', 'security', 'gdpr', 'audit', 'tenant', 'api', 'integrac'] },
    ],
  },
  {
    key: 'ui',
    label: 'Prostředí a ovládání',
    icon: '🖥️',
    desc: 'Vyhledávání, dark mode, klávesové zkratky, mobilní přístup',
    groups: [],
  },
  {
    key: 'terminology',
    label: 'Pojmy a terminologie',
    icon: '📖',
    desc: 'Vysvětlení účetních, daňových a obchodních pojmů',
    groups: [
      { key: 'term-ids', label: 'Identifikátory', icon: '🆔', match: ['ičo', 'dič', 'iban', 'swift', 'bic', 'variabilní symbol'] },
      { key: 'term-tax', label: 'Daňové pojmy', icon: '💹', match: ['dph', 'vat', 'základ dan', 'sazba', 'reverse charge', 'přenesen', 'třístranný', 'kontrolní', 'souhrnné', 'odpočet'] },
      { key: 'term-accounting', label: 'Účetní pojmy', icon: '📚', match: ['saldo', 'má dáti', 'dal', 'debet', 'kredit', 'odpis', 'depreciation', 'pohledávk', 'závazek', 'cash flow', 'erp'] },
      { key: 'term-business', label: 'Obchodní pojmy', icon: '💼', match: ['příjmy', 'revenue', 'tržby', 'náklad', 'expense', 'majetek', 'asset', 'datum zdanit', 'archivac', 'lhůta', 'náležitost', 'eet', 'zaokrouhl'] },
    ],
  },
  {
    key: 'help',
    label: 'Nápověda a řešení problémů',
    icon: '💡',
    desc: 'Řešení problémů, obecná nápověda a tipy',
    groups: [
      { key: 'help-trouble', label: 'Řešení problémů', icon: '🔧', match: ['problém', 'nefung', 'chyba', 'error', 'nemám přístup', 'nenačítá', 'nelze', 'nemohu', 'pomalý', 'timeout', 'špatný kurz', 'pdf nefung'] },
      { key: 'help-general', label: 'Obecná nápověda', icon: '🤝', match: ['pomoc', 'help', 'co umíš', 'kdo jsi', 'školení', 'podpora', 'kolik stojí', 'srovnání', 'srozumiteln', 'nerozumím'] },
      { key: 'help-greetings', label: 'Konverzace', icon: '👋', match: ['ahoj', 'dobrý den', 'děkuji', 'na shledanou', 'pozdrav', 'rozlouč'] },
    ],
  },
];

// Classify a single KB item into section + subgroup
function classifyItem(item) {
  const text = [item.keywords, item.question_cs, item.question_en, item.answer_cs].join(' ').toLowerCase();

  // Special rules by DB category to map into our refined sections
  if (item.category === 'navigation') return { section: 'navigation', group: null };
  if (item.category === 'terminology') return { section: 'terminology', group: null };

  // For 'feature' and 'help' categories, classify by content
  for (const sec of SECTIONS) {
    if (sec.key === 'navigation' || sec.key === 'terminology') continue;
    for (const g of sec.groups) {
      if (g.match.some(m => text.includes(m))) return { section: sec.key, group: g.key };
    }
  }

  // Fallback heuristics for unmatched items
  if (/klient|client|zákazní|customer|odběratel/.test(text)) return { section: 'clients', group: null };
  if (/dph|vat|daň|plátce/.test(text)) return { section: 'vat', group: null };
  if (/hled|search|dark|tmavý|mobil|klávesov|shortcut|prohlížeč|browser|responsive|offline|app/.test(text)) return { section: 'ui', group: null };
  if (/účetnictví|účtov|deník|journal|ledger|kniha/.test(text)) return { section: 'accounting', group: null };
  if (/faktur|invoice|dobropis|proforma/.test(text)) return { section: 'invoices', group: null };
  if (/platb|payment|banka|bank|párov|match|qr/.test(text)) return { section: 'payments', group: null };
  if (/společnost|company|uživatel|user|role|logo|záloha|backup/.test(text)) return { section: 'settings', group: null };
  if (item.category === 'help') return { section: 'help', group: null };
  return { section: 'help', group: null };
}

// Assign items to their navigation subgroup
function classifyNavItem(item) {
  const text = [item.keywords, item.question_cs].join(' ').toLowerCase();
  const navSection = SECTIONS.find(s => s.key === 'navigation');
  for (const g of navSection.groups) {
    if (g.match.some(m => text.includes(m))) return g.key;
  }
  return 'nav-general';
}

function classifyTermItem(item) {
  const text = [item.keywords, item.question_cs, item.answer_cs].join(' ').toLowerCase();
  const termSection = SECTIONS.find(s => s.key === 'terminology');
  for (const g of termSection.groups) {
    if (g.match.some(m => text.includes(m))) return g.key;
  }
  return 'term-business';
}

const Chevron = ({ open, size = 18 }) => (
  <svg className={`faq-chevron ${open ? 'open' : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
);

function highlightMatch(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark style={{ background: '#fef08a', padding: '0 1px', borderRadius: 2 }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

export default function ChatbotSettings() {
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [openItems, setOpenItems] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getChatbotKnowledge().then(data => {
      setKnowledge(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggle = (setter, key) => setter(prev => ({ ...prev, [key]: !prev[key] }));

  // Build structured data: section → group → items
  const structured = useMemo(() => {
    const result = {};
    for (const sec of SECTIONS) {
      result[sec.key] = { groups: {}, ungrouped: [] };
      for (const g of sec.groups) {
        result[sec.key].groups[g.key] = [];
      }
    }

    for (const item of knowledge) {
      const { section, group } = classifyItem(item);
      let assignedGroup = group;

      // For navigation and terminology, do sub-classification
      if (section === 'navigation' && !assignedGroup) {
        assignedGroup = classifyNavItem(item);
      }
      if (section === 'terminology' && !assignedGroup) {
        assignedGroup = classifyTermItem(item);
      }

      const sec = result[section];
      if (!sec) continue;
      if (assignedGroup && sec.groups[assignedGroup]) {
        sec.groups[assignedGroup].push(item);
      } else {
        sec.ungrouped.push(item);
      }
    }

    // Sort by priority
    for (const sec of Object.values(result)) {
      sec.ungrouped.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      for (const items of Object.values(sec.groups)) {
        items.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      }
    }
    return result;
  }, [knowledge]);

  // Filter by search
  const q = search.trim().toLowerCase();
  const matchItem = (it) =>
    (it.question_cs || '').toLowerCase().includes(q) ||
    (it.answer_cs || '').toLowerCase().includes(q) ||
    (it.keywords || '').toLowerCase().includes(q) ||
    (it.question_en || '').toLowerCase().includes(q);

  const totalCount = knowledge.length;
  let filteredCount = 0;

  // Count filtered items
  if (q) {
    for (const item of knowledge) {
      if (matchItem(item)) filteredCount++;
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><h1>Chatbot Hyňa — Znalostní báze</h1></div>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>Načítám...</div>
      </div>
    );
  }

  const sectionCount = SECTIONS.filter(sec => {
    const data = structured[sec.key];
    const hasUngrouped = data.ungrouped.length > 0;
    const hasGroups = Object.values(data.groups).some(g => g.length > 0);
    return hasUngrouped || hasGroups;
  }).length;

  const renderItem = (item) => {
    if (q && !matchItem(item)) return null;
    const isOpen = openItems[item.id];
    return (
      <div key={item.id} className="faq-item">
        <button className={`faq-item-header ${isOpen ? 'open' : ''}`} onClick={() => toggle(setOpenItems, item.id)}>
          <span className="faq-item-q">{q ? highlightMatch(item.question_cs || item.question_en, q) : (item.question_cs || item.question_en)}</span>
          <Chevron open={isOpen} size={14} />
        </button>
        {isOpen && (
          <div className="faq-item-body">
            <p>{q ? highlightMatch(item.answer_cs || item.answer_en, q) : (item.answer_cs || item.answer_en)}</p>
            {item.link && (
              <div className="faq-item-link">
                <a href={item.link}>Přejít na stránku →</a>
              </div>
            )}
            {item.question_en && (
              <div className="faq-item-en">
                <strong>EN:</strong> {item.question_en}<br />
                {item.answer_en}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (sec) => {
    const data = structured[sec.key];
    const allItems = [...data.ungrouped, ...Object.values(data.groups).flat()];
    const visibleItems = q ? allItems.filter(matchItem) : allItems;
    if (visibleItems.length === 0) return null;

    const isOpen = openSections[sec.key] || !!q;
    const hasSubgroups = sec.groups.length > 0 && Object.values(data.groups).some(g => g.length > 0);

    return (
      <div key={sec.key} className="faq-category">
        <button className={`faq-category-header ${isOpen ? 'open' : ''}`} onClick={() => toggle(setOpenSections, sec.key)}>
          <div className="faq-category-title">
            <span className="faq-category-icon">{sec.icon}</span>
            <div>
              <strong>{sec.label}</strong>
              <span className="faq-category-desc">{sec.desc}</span>
            </div>
          </div>
          <div className="faq-category-meta">
            <span className="badge badge-secondary">{visibleItems.length}</span>
            <Chevron open={isOpen} />
          </div>
        </button>
        {isOpen && (
          <div className="faq-category-body">
            {/* Ungrouped items directly */}
            {(q ? data.ungrouped.filter(matchItem) : data.ungrouped).map(renderItem)}

            {/* Subgroups */}
            {hasSubgroups && sec.groups.map(g => {
              const gItems = q ? (data.groups[g.key] || []).filter(matchItem) : (data.groups[g.key] || []);
              if (gItems.length === 0) return null;
              const gOpen = openGroups[g.key] || !!q;
              return (
                <div key={g.key} className="faq-subgroup">
                  <button className={`faq-subgroup-header ${gOpen ? 'open' : ''}`} onClick={() => toggle(setOpenGroups, g.key)}>
                    <div className="faq-subgroup-title">
                      <span className="faq-subgroup-icon">{g.icon}</span>
                      <span>{g.label}</span>
                    </div>
                    <div className="faq-category-meta">
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{gItems.length}</span>
                      <Chevron open={gOpen} size={15} />
                    </div>
                  </button>
                  {gOpen && (
                    <div className="faq-subgroup-body">
                      {gItems.map(renderItem)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const hasResults = SECTIONS.some(sec => {
    const data = structured[sec.key];
    const allItems = [...data.ungrouped, ...Object.values(data.groups).flat()];
    return q ? allItems.some(matchItem) : allItems.length > 0;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Chatbot Hyňa — Znalostní báze</h1>
          <p style={{ color: 'var(--gray-500)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Kompletní přehled {totalCount} otázek a odpovědí v {sectionCount} kategoriích
          </p>
        </div>
      </div>

      {/* Search — local only, not indexed in global search */}
      <div className="faq-search-bar">
        <div className="faq-search-wrap">
          <svg className="faq-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            className="form-input faq-search-input"
            placeholder="Hledat v otázkách a odpovědích..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {q && (
            <button className="faq-search-clear" onClick={() => setSearch('')} title="Vymazat">&times;</button>
          )}
        </div>
        {q && (
          <span className="faq-search-count">
            Nalezeno {filteredCount} z {totalCount} otázek
          </span>
        )}
      </div>

      {/* Accordion */}
      <div className="faq-accordion">
        {SECTIONS.map(renderSection)}
      </div>

      {!hasResults && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>
          Žádné výsledky pro &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
