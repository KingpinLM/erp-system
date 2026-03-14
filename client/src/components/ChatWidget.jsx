import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';

const GREETING_CS = 'Ahoj! Jsem Hyňa, váš asistent pro navigaci v ERP systému. Jak vám mohu pomoci?';
const GREETING_EN = 'Hello! I\'m Hyňa, your ERP navigation assistant. How can I help you?';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'bot', text: GREETING_CS }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await api.chatbotMessage(text, convId);
      setConvId(res.conversation_id);
      setMessages(m => [...m, { role: 'bot', text: res.answer, link: res.link }]);
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'Omlouvám se, nastala chyba. Zkuste to prosím znovu.' }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleLink = (link) => {
    navigate(link);
    setOpen(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        className="chatbot-fab"
        onClick={() => setOpen(o => !o)}
        title="Hyňa - asistent"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">H</div>
              <div>
                <div className="chatbot-name">Hyňa</div>
                <div className="chatbot-status">Asistent navigace</div>
              </div>
            </div>
            <button className="chatbot-close" onClick={() => setOpen(false)}>&times;</button>
          </div>
          <div className="chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-msg chatbot-msg-${m.role}`}>
                <div className="chatbot-bubble">
                  {m.text}
                  {m.link && (
                    <button className="chatbot-link" onClick={() => handleLink(m.link)}>
                      Přejít na stránku →
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chatbot-msg chatbot-msg-bot">
                <div className="chatbot-bubble chatbot-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>
          <div className="chatbot-input-area">
            <input
              ref={inputRef}
              className="chatbot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Napište zprávu..."
              disabled={loading}
            />
            <button className="chatbot-send" onClick={send} disabled={!input.trim() || loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
