import { useMemo, useState } from 'react';
import { useScreengridStore } from '../store/useScreengridStore.js';

const PROMPTS = [
  'Show density hotspots with reliability warnings',
  'Switch to categorical composition using global normalisation',
  'Make this a temporal trend comparison',
  'Use hex cells and highlight uncertainty'
];

export function ChatComposer() {
  const chat = useScreengridStore((state) => state.chat);
  const activeProposal = useScreengridStore((state) => state.activeProposal);
  const sendChat = useScreengridStore((state) => state.sendChat);
  const askProvider = useScreengridStore((state) => state.askProvider);
  const applyAction = useScreengridStore((state) => state.applyAction);
  const rejectProposal = useScreengridStore((state) => state.rejectProposal);
  const provider = useScreengridStore((state) => state.provider);
  const setProvider = useScreengridStore((state) => state.setProvider);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('local');

  const canUseProvider = useMemo(() => provider.apiKey.trim().length > 0, [provider.apiKey]);

  async function submit(text = draft) {
    const content = text.trim();
    if (!content) return;
    setDraft('');
    if (mode === 'provider' && canUseProvider) await askProvider(content);
    else await sendChat(content);
  }

  return (
    <section className="chat-surface">
      <header className="panel-title">
        <div>
          <h2>Grammar Chat</h2>
          <p>Natural language becomes validated JSON Patch operations over the Screengrid grammar.</p>
        </div>
        <div className="mode-toggle" role="tablist" aria-label="Assistant mode">
          <button type="button" className={mode === 'local' ? 'selected' : ''} onClick={() => setMode('local')}>Local</button>
          <button type="button" className={mode === 'provider' ? 'selected' : ''} onClick={() => setMode('provider')}>Provider</button>
        </div>
      </header>

      {mode === 'provider' ? (
        <div className="provider-row">
          <input value={provider.baseUrl} onChange={(event) => setProvider({ baseUrl: event.target.value })} aria-label="Provider base URL" />
          <input value={provider.model} onChange={(event) => setProvider({ model: event.target.value })} aria-label="Model" />
          <input value={provider.apiKey} type="password" placeholder="API key" onChange={(event) => setProvider({ apiKey: event.target.value })} aria-label="API key" />
        </div>
      ) : null}

      <div className="prompt-row">
        {PROMPTS.map((prompt) => (
          <button type="button" key={prompt} onClick={() => submit(prompt)}>{prompt}</button>
        ))}
      </div>

      <div className="chat-log" aria-live="polite">
        {chat.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>

      {activeProposal ? (
        <div className="proposal-dock">
          <div>
            <strong>{activeProposal.summary}</strong>
            <p>{activeProposal.rationale}</p>
          </div>
          {activeProposal.actions.map((action) => (
            <div className="proposal-action" key={action.id}>
              <span>{action.label}</span>
              <code>{action.patch.length} patch ops</code>
              <button type="button" onClick={() => applyAction(action.id)}>Apply</button>
            </div>
          ))}
          <button type="button" className="subtle-button" onClick={rejectProposal}>Reject proposal</button>
        </div>
      ) : null}

      <form className="composer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask: make this a temporal profile glyph with global scaling..."
          rows={3}
        />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}

function ChatMessage({ message }) {
  if (message.kind === 'proposal') {
    return (
      <article className="chat-message assistant proposal-message">
        <strong>{message.proposal.summary}</strong>
        <p>{message.proposal.rationale}</p>
        <pre>{JSON.stringify(message.proposal.actions[0]?.patch || [], null, 2)}</pre>
      </article>
    );
  }
  return (
    <article className={`chat-message ${message.role} ${message.tone || ''}`}>
      <p>{message.content}</p>
    </article>
  );
}
