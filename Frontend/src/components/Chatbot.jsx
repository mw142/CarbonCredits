import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import mark from '../assets/brand/renewco-mark.svg';

function BotIcon({ size = 28 }) {
  return (
    <svg className="chatbot-robot-icon" width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="9" y="14" width="30" height="24" rx="8" stroke="currentColor" strokeWidth="2.4" />
      <g className="chatbot-robot-eyes">
        <circle cx="19" cy="26" r="3" fill="currentColor" />
        <circle cx="29" cy="26" r="3" fill="currentColor" />
      </g>
      <path d="M19 33h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17 10c4-3 10-3 14 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="33" cy="8" r="2.4" fill="currentColor" />
    </svg>
  );
}

export default function Chatbot() {
  const { token, user } = useAuth();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(null);
  const [messages, setMessages] = useState([]);
  const endRef = useRef(null);

  const greeting = t('Hi — I am the renewCo. assistant. I can explain how the marketplace works, find projects in the register, and help with emissions tracking, introductions and reports. I cannot approve claims or check the live CER registry.');
  const starters = [t('How does this marketplace work?'), t('Find vegetation projects in NSW'), t('How do buyer introductions work?'), t('How do I claim a CER project?')];

  useEffect(() => {
    let cancelled = false;
    api.get('/ai/status')
      .then((data) => { if (!cancelled) setConfigured(Boolean(data.configured)); })
      .catch(() => { if (!cancelled) setConfigured(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, busy]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    try {
      const data = await api.post('/ai/chat', { messages: nextMessages, language: lang }, token);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: err.message || t('Sorry — I could not reach the assistant right now.') }]);
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = { buyer: t('Buyer'), seller: t('Seller'), admin: t('Admin') }[user?.role] || t('Guest');

  return (
    <div className="chatbot" data-open={open ? 'true' : 'false'}>
      {open && (
        <section id="chatbot-panel" className="chatbot-panel" aria-label={t('renewCo. assistant')}>
          <header className="chatbot-header">
            <div className="chatbot-header-main">
              <span className="chatbot-header-avatar" aria-hidden="true"><img src={mark} alt="" style={{ width: 30 }} /></span>
              <div>
                <p className="chatbot-kicker">{t('renewCo. assistant')}</p>
                <h2>{t('Ask about carbon credits')}</h2>
                <p className="chatbot-meta">{t('Chatting as {role}', { role: roleLabel })}</p>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm chatbot-close" onClick={() => setOpen(false)} aria-label={t('Close')}>{t('Close')}</button>
          </header>

          {configured === false && (
            <div className="chatbot-banner">{t('The assistant is offline until GROQ_API_KEY is set in Backend/.env.')}</div>
          )}

          <div className="chatbot-messages" role="log" aria-live="polite">
            <div className="chatbot-bubble chatbot-bubble-assistant">{greeting}</div>
            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`chatbot-bubble chatbot-bubble-${m.role}`}>{m.content}</div>
            ))}
            {busy && <div className="chatbot-bubble chatbot-bubble-assistant chatbot-typing">{t('Thinking…')}</div>}
            <div ref={endRef} />
          </div>

          {!messages.length ? (
            <div className="chatbot-starters">
              {starters.map((hint) => (
                <button key={hint} type="button" className="chatbot-chip" disabled={busy || configured === false} onClick={() => send(hint)}>{hint}</button>
              ))}
            </div>
          ) : null}

          <form className="chatbot-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('Ask about projects, ACCUs, emissions…')} disabled={busy || configured === false} aria-label={t('Message')} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !input.trim() || configured === false}>{t('Send')}</button>
          </form>
          <div className="chatbot-foot">{t('AI answers can be wrong. Not financial advice.')}</div>
        </section>
      )}

      <button
        type="button"
        className="chatbot-toggle"
        data-open={open ? 'true' : 'false'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="chatbot-panel"
        aria-label={open ? t('Hide chat') : t('Ask assistant')}
      >
        {open ? <span className="chatbot-toggle-close" aria-hidden="true">×</span> : <BotIcon size={28} />}
        {!open && <span className="chatbot-toggle-label">{t('Ask renewCo.')}</span>}
      </button>
    </div>
  );
}
