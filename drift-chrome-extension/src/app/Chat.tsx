import { useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../config';
import { patchSettings, type Settings } from '../state/settings';
import { usePrContext } from '../state/prContext';
import { FileModal } from './FileModal';
import { FileIcon } from './FileIcon';
import { AudioSummary } from './AudioSummary';
import { buildReasoning, reasoningTitle, type ReasoningStep } from './reasoning';
import { getChat, saveChat, clearChat, type ChatMessage } from '../state/chatHistory';
import type { ArtifactRef, PrContext } from '../core/types';

const STEP_INTERVAL_MS = 450;

// The chat surface. Conversations are persisted per PR url (chat history), so
// revisiting a PR restores its conversation instantly — the reasoning streams
// once, then loads from storage with no re-animation.
export function Chat({
  settings,
  onOpenSettings,
  onOpenContext,
  onOpenPipeline,
}: {
  settings: Settings;
  onOpenSettings: () => void;
  onOpenContext: () => void;
  onOpenPipeline: () => void;
}) {
  // The conversation is bound to a PR url so persistence is always atomic.
  const [chat, setChat] = useState<{ url: string | null; messages: ChatMessage[] }>({
    url: null,
    messages: [],
  });
  const messages = chat.messages;
  const [draft, setDraft] = useState('');
  const [modalFile, setModalFile] = useState<ArtifactRef | null>(null);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const targetUrl = useRef<string | null>(null);
  const streamIv = useRef<number | null>(null);
  const { ctx, refresh } = usePrContext();

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const stopStream = () => {
    if (streamIv.current != null) {
      window.clearInterval(streamIv.current);
      streamIv.current = null;
    }
  };

  // Stream the step-by-step reasoning turn for a freshly-detected PR.
  function startReasoning(c: PrContext) {
    const allSteps = buildReasoning(c);
    const id = nextId.current++;
    setChat((prev) =>
      prev.messages.some((x) => x.steps && x.prUrl === c.pr.url)
        ? prev
        : {
            ...prev,
            messages: [
              ...prev.messages,
              { id, role: 'assistant', title: reasoningTitle(c), steps: [], thinking: true, prUrl: c.pr.url },
            ],
          },
    );
    let shown = 0;
    stopStream();
    streamIv.current = window.setInterval(() => {
      shown += 1;
      setChat((prev) => ({
        ...prev,
        messages: prev.messages.map((x) =>
          x.id === id ? { ...x, steps: allSteps.slice(0, shown), thinking: shown < allSteps.length } : x,
        ),
      }));
      scrollToBottom();
      if (shown >= allSteps.length) stopStream();
    }, STEP_INTERVAL_MS);
  }

  // Switch conversation when the active PR changes: persist the outgoing one,
  // restore the incoming one from storage (instant), or stream it fresh.
  useEffect(() => {
    const url = ctx?.pr.url ?? null;
    if (url === chatRef.current.url) return;
    targetUrl.current = url;

    const prev = chatRef.current;
    if (prev.url && prev.messages.length) void saveChat(prev.url, prev.messages);
    stopStream();

    if (!url || !ctx) {
      setChat({ url, messages: [] });
      return;
    }
    const pr = ctx;
    void getChat(url).then((saved) => {
      if (targetUrl.current !== url) return; // navigated again — drop stale load
      if (saved.length) {
        nextId.current = Math.max(0, ...saved.map((m) => m.id)) + 1;
        setChat({ url, messages: saved }); // instant restore — no re-stream
      } else {
        setChat({ url, messages: [] });
        startReasoning(pr);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.pr.url]);

  // Persist the conversation (debounced) under its PR url.
  useEffect(() => {
    if (!chat.url) return;
    const t = window.setTimeout(() => void saveChat(chat.url!, chat.messages), 500);
    return () => window.clearTimeout(t);
  }, [chat]);

  // Stop any running stream when the panel unmounts.
  useEffect(() => stopStream, []);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const grounded = ctx ? `Using context from ${ctx.pr.repo}#${ctx.pr.number}. ` : '';
    setChat((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        { id: nextId.current++, role: 'user', text },
        {
          id: nextId.current++,
          role: 'assistant',
          text: `${grounded}No model is connected yet — wire a backend in the chat handler to get real replies.`,
        },
      ],
    }));
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
    stopStream();
    const url = chatRef.current.url;
    setChat({ url, messages: [] });
    if (url) void clearChat(url);
    if (ctx) startReasoning(ctx);
  }

  return (
    <div className="drift-app drift-root">
      <header className="app-bar">
        <span className="drift-logo" />
        <h1>{APP_NAME}</h1>
        <span className="spacer" />
        <button className="iconbtn" title="Rescan this page" onClick={() => void refresh()}>
          ↻
        </button>
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
        <button
          className="iconbtn"
          title="Live pipeline — run the scan + render the PR comment here (no AI)"
          onClick={onOpenPipeline}
        >
          ⚡
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
        {/* Spoken summary, when the PR's comment linked one — playable inline. */}
        {ctx?.audio && messages.length > 0 && <AudioSummary audio={ctx.audio} />}
      </div>

      <div className="composer">
        <div className="composer-box">
          {ctx && (
            <div className="attach-row">
              {ctx.artifacts.map((a) => (
                <button
                  key={a.url ?? a.name}
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
            <button key={f.url ?? f.name} className="rfile-btn" onClick={() => onOpenFile?.(f)}>
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
