import { useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../config';
import { patchSettings, type Settings } from '../state/settings';
import { usePrContext } from '../state/prContext';
import { FileModal } from './FileModal';
import { FileIcon } from './FileIcon';
import { buildReasoning, reasoningTitle, type ReasoningStep } from './reasoning';
import type { ArtifactRef } from '../core/types';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  /** Present on the auto-generated reasoning turn. */
  title?: string;
  steps?: ReasoningStep[];
  thinking?: boolean;
}

// PRs we've already auto-reasoned about this session. Module-level so it
// survives Chat remounts (e.g. flipping to Settings and back) — we don't want
// to replay the assessment every time the panel re-renders.
const reasonedPrs = new Set<string>();

const STEP_INTERVAL_MS = 450;

// The chat surface. No model backend is wired yet, so sending echoes a
// placeholder. But the moment a PR is recognised we stream a grounded,
// step-by-step assessment built from the parsed Drift report.
export function Chat({
  settings,
  onOpenSettings,
  onOpenContext,
}: {
  settings: Settings;
  onOpenSettings: () => void;
  onOpenContext: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [modalFile, setModalFile] = useState<ArtifactRef | null>(null);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ctx } = usePrContext();

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  // When a PR is recognised, stream a step-by-step reasoning turn AND attach the
  // two context files into the chat (each loads step-by-step). Once per PR.
  useEffect(() => {
    if (!ctx || reasonedPrs.has(ctx.pr.url)) return;
    reasonedPrs.add(ctx.pr.url);

    const allSteps = buildReasoning(ctx);
    const id = nextId.current++;
    setMessages((m) => [
      ...m,
      { id, role: 'assistant', title: reasoningTitle(ctx), steps: [], thinking: true },
    ]);

    let shown = 0;
    const iv = window.setInterval(() => {
      shown += 1;
      setMessages((m) =>
        m.map((x) =>
          x.id === id
            ? { ...x, steps: allSteps.slice(0, shown), thinking: shown < allSteps.length }
            : x,
        ),
      );
      scrollToBottom();
      if (shown >= allSteps.length) window.clearInterval(iv);
    }, STEP_INTERVAL_MS);

    return () => window.clearInterval(iv);
    // Key on the stable PR url ONLY — ctx is a fresh object on every refresh
    // (tab/storage events), and depending on it would clear the stream mid-way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.pr.url]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const user: ChatMessage = { id: nextId.current++, role: 'user', text };
    const grounded = ctx ? `Using context from ${ctx.pr.repo}#${ctx.pr.number}. ` : '';
    const reply: ChatMessage = {
      id: nextId.current++,
      role: 'assistant',
      text: `${grounded}No model is connected yet — wire a backend in the chat handler to get real replies.`,
    };
    setMessages((m) => [...m, user, reply]);
    setDraft('');
    scrollToBottom();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function newChat() {
    setMessages([]);
    if (ctx) reasonedPrs.delete(ctx.pr.url); // allow re-running the assessment
  }

  return (
    <div className="drift-app drift-root">
      <header className="app-bar">
        <span className="drift-logo" />
        <h1>{APP_NAME}</h1>
        <span className="spacer" />
        {ctx && (
          <button className="iconbtn ctx-btn" title="Loaded context" onClick={onOpenContext}>
            📎<span className="ctx-btn-count">{ctx.artifacts.length}</span>
          </button>
        )}
        <button
          className="iconbtn"
          title="New chat"
          onClick={newChat}
          disabled={messages.length === 0}
        >
          ＋
        </button>
        <button className="iconbtn" title="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="mark" />
            <h2>How can I help?</h2>
            <p>Ask about the PR or file you’re viewing. Use “/” for commands.</p>
          </div>
        ) : (
          messages.map((m) =>
            m.steps ? (
              <ReasoningTurn
                key={m.id}
                title={m.title}
                steps={m.steps}
                thinking={!!m.thinking}
                files={ctx?.artifacts}
                onOpenFile={setModalFile}
              />
            ) : (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className={`bubble ${m.role === 'assistant' ? 'muted' : ''}`}>{m.text}</div>
              </div>
            ),
          )
        )}
      </div>

      <div className="composer">
        <div className="composer-box">
          {ctx && (
            <div className="attach-row">
              {ctx.artifacts.map((a) => (
                <button
                  key={a.name}
                  className="attach-chip"
                  onClick={() => setModalFile(a)}
                  title={`Open ${a.name}`}
                >
                  <FileIcon size={16} />
                  <span className="attach-name">{a.name}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            rows={1}
            placeholder="Type / for commands"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="composer-row">
            <button
              className="ask-toggle"
              data-on={settings.askBeforeActing}
              onClick={() => void patchSettings({ askBeforeActing: !settings.askBeforeActing })}
              title="Toggle whether actions need confirmation"
            >
              {settings.askBeforeActing ? '✋ Ask before acting' : '⚡ Act automatically'}
            </button>
            <button className="send" onClick={send} disabled={!draft.trim()} title="Send">
              ↑
            </button>
          </div>
        </div>
        <div className="composer-foot">{APP_NAME} is AI and can make mistakes.</div>
      </div>

      {modalFile && <FileModal artifact={modalFile} onClose={() => setModalFile(null)} />}
    </div>
  );
}

function ReasoningTurn({
  title,
  steps,
  thinking,
  files,
  onOpenFile,
}: {
  title?: string;
  steps: ReasoningStep[];
  thinking: boolean;
  files?: ArtifactRef[];
  onOpenFile?: (a: ArtifactRef) => void;
}) {
  return (
    <div className="reasoning">
      <div className="reasoning-head">
        {thinking ? <span className="spinner" /> : <span className="reasoning-check">✓</span>}
        <span>{thinking ? title ?? 'Thinking…' : title ?? 'Reasoned'}</span>
      </div>
      <ol className="reasoning-steps">
        {steps.map((s, i) => (
          <li key={i} className={`rs-${s.level}`}>
            {s.text}
          </li>
        ))}
        {thinking && (
          <li className="rs-typing">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </li>
        )}
      </ol>
      {!thinking && files && files.length > 0 && (
        <div className="reasoning-files">
          <span className="rfiles-label">Download:</span>
          {files.map((f) => (
            <button key={f.name} className="rfile-btn" onClick={() => onOpenFile?.(f)}>
              <FileIcon size={14} />
              <span>{f.name}</span>
              <span className="rfile-dl">⬇</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
