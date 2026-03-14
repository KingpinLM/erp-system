import React, { useState, useEffect } from 'react';
import { api } from '../api';

const CATEGORY_LABELS = {
  navigation: { cs: 'Navigace', icon: '🧭', desc: 'Kde najdu jednotlivé sekce a funkce' },
  feature: { cs: 'Funkce a operace', icon: '⚙️', desc: 'Jak pracovat s fakturami, platbami a dalšími' },
  help: { cs: 'Nápověda a řešení problémů', icon: '💡', desc: 'Tipy, triky a řešení častých problémů' },
  terminology: { cs: 'Pojmy a terminologie', icon: '📖', desc: 'Vysvětlení účetních a obchodních pojmů' },
};

const CATEGORY_ORDER = ['navigation', 'feature', 'help', 'terminology'];

export default function ChatbotSettings() {
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCats, setOpenCats] = useState({});
  const [openItems, setOpenItems] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getChatbotKnowledge().then(data => {
      setKnowledge(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleCat = (cat) => setOpenCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleItem = (id) => setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));

  // Group by category
  const grouped = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  for (const item of knowledge) {
    const cat = item.category || 'help';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  // Sort each group by priority desc
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // Filter by search
  const q = search.toLowerCase();
  const filteredGrouped = {};
  for (const [cat, items] of Object.entries(grouped)) {
    const filtered = q
      ? items.filter(it =>
          (it.question_cs || '').toLowerCase().includes(q) ||
          (it.answer_cs || '').toLowerCase().includes(q) ||
          (it.keywords || '').toLowerCase().includes(q)
        )
      : items;
    if (filtered.length > 0) filteredGrouped[cat] = filtered;
  }

  const totalCount = knowledge.length;
  const filteredCount = Object.values(filteredGrouped).reduce((s, arr) => s + arr.length, 0);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><h1>Chatbot Hyňa — Znalostní báze</h1></div>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>Načítám...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Chatbot Hyňa — Znalostní báze</h1>
          <p style={{ color: 'var(--gray-500)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Kompletní přehled {totalCount} otázek a odpovědí rozdělených do {Object.keys(grouped).length} kategorií
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.25rem' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Hledat v otázkách a odpovědích..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 420 }}
        />
        {q && (
          <span style={{ marginLeft: 12, color: 'var(--gray-500)', fontSize: '0.85rem' }}>
            Nalezeno: {filteredCount} z {totalCount}
          </span>
        )}
      </div>

      {/* Accordion */}
      <div className="faq-accordion">
        {CATEGORY_ORDER.filter(cat => filteredGrouped[cat]).map(cat => {
          const meta = CATEGORY_LABELS[cat] || { cs: cat, icon: '📁', desc: '' };
          const items = filteredGrouped[cat];
          const isOpen = openCats[cat] || !!q;

          return (
            <div key={cat} className="faq-category">
              <button className={`faq-category-header ${isOpen ? 'open' : ''}`} onClick={() => toggleCat(cat)}>
                <div className="faq-category-title">
                  <span className="faq-category-icon">{meta.icon}</span>
                  <div>
                    <strong>{meta.cs}</strong>
                    <span className="faq-category-desc">{meta.desc}</span>
                  </div>
                </div>
                <div className="faq-category-meta">
                  <span className="badge badge-secondary">{items.length}</span>
                  <svg className={`faq-chevron ${isOpen ? 'open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </button>
              {isOpen && (
                <div className="faq-category-body">
                  {items.map(item => {
                    const itemOpen = openItems[item.id];
                    return (
                      <div key={item.id} className="faq-item">
                        <button className={`faq-item-header ${itemOpen ? 'open' : ''}`} onClick={() => toggleItem(item.id)}>
                          <span className="faq-item-q">{item.question_cs || item.question_en}</span>
                          <svg className={`faq-chevron ${itemOpen ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {itemOpen && (
                          <div className="faq-item-body">
                            <p>{item.answer_cs || item.answer_en}</p>
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
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(filteredGrouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>
          Žádné výsledky pro "{search}"
        </div>
      )}
    </div>
  );
}
