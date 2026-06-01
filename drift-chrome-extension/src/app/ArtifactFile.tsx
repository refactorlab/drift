import { useEffect, useRef, useState } from 'react';
import type { ArtifactRef } from '../core/types';
import {
  artifactIdFromUrl,
  getStoredArtifact,
  loadArtifact,
  type StoredArtifact,
} from '../state/artifacts';
import { FileIcon } from './FileIcon';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function describe(kind: ArtifactRef['kind']): string {
  switch (kind) {
    case 'scan-report':
      return 'Complete, uncapped scanner report — every risk, suggestion and metric.';
    case 'scan-context':
      return 'PR identity, exact diff scope, and run/scanner pointers an agent can reload.';
    default:
      return 'Machine-readable scanner output.';
  }
}

// Pretty-print JSON when possible, clip very large files so the DOM stays
// responsive (the full file is always saved to disk).
const DISPLAY_LIMIT = 500_000;
function prepare(raw: string): { text: string; clipped: boolean; total: number } {
  let text = raw;
  try {
    text = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* not JSON / already formatted */
  }
  return text.length > DISPLAY_LIMIT
    ? { text: text.slice(0, DISPLAY_LIMIT), clipped: true, total: text.length }
    : { text, clipped: false, total: text.length };
}

type Phase = 'idle' | 'downloading' | 'ready' | 'error';
type Save =
  | { state: 'idle' | 'saving' }
  | { state: 'done'; path?: string; bytes?: number }
  | { state: 'missing'; path?: string }
  | { state: 'error'; error: string };

const saveKey = (url: string) => `drift:download:${url}`;

export function ArtifactFile({
  artifact,
  defaultOpen = false,
}: {
  artifact: ArtifactRef;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [phase, setPhase] = useState<Phase>('idle');
  const [rec, setRec] = useState<StoredArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<Save>({ state: 'idle' });
  const started = useRef(false);
  const dlId = useRef<number | null>(null);
  const blobUrl = useRef<string | null>(null);
  const idText = artifactIdFromUrl(artifact.url) ? `#${artifactIdFromUrl(artifact.url)}` : '';

  // ── Download bytes into the extension + show them ──────────────────────
  async function fetchAndShow() {
    if (started.current) return;
    started.current = true;
    const cached = artifact.url ? await getStoredArtifact(artifact.url) : null;
    if (cached) {
      setRec(cached);
      setPhase('ready');
      return;
    }
    setPhase('downloading');
    const result = await loadArtifact(artifact);
    if (result.ok) {
      setRec(result.rec);
      setPhase('ready');
    } else {
      setError(result.error);
      setPhase('error');
    }
  }

  // ── Save to disk (from the already-fetched bytes) + verify it's there ──
  function saveToDisk(saveAs = false) {
    if (!rec || !artifact.url) return;
    setSave({ state: 'saving' });
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = URL.createObjectURL(new Blob([rec.content], { type: 'application/json' }));
    chrome.downloads.download({ url: blobUrl.current, filename: artifact.name, saveAs }, (id) => {
      if (chrome.runtime.lastError || id === undefined) {
        setSave({ state: 'error', error: chrome.runtime.lastError?.message ?? 'blocked' });
        return;
      }
      dlId.current = id;
    });
  }
  const showInFolder = () => dlId.current != null && chrome.downloads.show(dlId.current);
  const openFile = () => dlId.current != null && chrome.downloads.open(dlId.current);

  // Check whether a previously-saved copy still exists on disk.
  async function checkExisting() {
    if (!artifact.url) return;
    const key = saveKey(artifact.url);
    const stored = (await chrome.storage.local.get(key))[key] as
      | { id: number; path?: string }
      | undefined;
    if (!stored) return;
    dlId.current = stored.id;
    chrome.downloads.search({ id: stored.id }, (items) => {
      const it = items[0];
      if (it?.exists) setSave({ state: 'done', path: it.filename, bytes: it.fileSize });
      else setSave({ state: 'missing', path: stored.path });
    });
  }

  useEffect(() => {
    const onChanged = (d: chrome.downloads.DownloadDelta) => {
      if (dlId.current === null || d.id !== dlId.current) return;
      if (d.state?.current === 'complete') {
        chrome.downloads.search({ id: d.id }, (items) => {
          const it = items[0];
          setSave({ state: 'done', path: it?.filename, bytes: it?.fileSize || it?.totalBytes });
          if (artifact.url)
            void chrome.storage.local.set({
              [saveKey(artifact.url)]: { id: d.id, path: it?.filename },
            });
        });
        if (blobUrl.current) {
          URL.revokeObjectURL(blobUrl.current);
          blobUrl.current = null;
        }
      } else if (d.state?.current === 'interrupted') {
        setSave({ state: 'error', error: d.error?.current ?? 'interrupted' });
      }
    };
    chrome.downloads.onChanged.addListener(onChanged);
    return () => chrome.downloads.onChanged.removeListener(onChanged);
  }, [artifact.url]);

  function onPress() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    void fetchAndShow();
    void checkExisting();
  }
  function retry() {
    started.current = false;
    setError(null);
    void fetchAndShow();
  }

  useEffect(() => {
    if (defaultOpen) {
      void fetchAndShow();
      void checkExisting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = rec ? prepare(rec.content) : null;
  const savedName = (p?: string) => (p ? p.split(/[\\/]/).pop() : undefined);

  return (
    <div className={`file-card ${open ? 'open' : ''}`}>
      <div className="file-card-main">
        <FileIcon />
        <div className="file-card-info" onClick={onPress} role="button" title="Open file">
          <div className="file-card-name">
            {artifact.name}
            <span className="ctx-kind">{artifact.kind.replace('scan-', '')}</span>
          </div>
          <div className="file-card-sub">{describe(artifact.kind)}</div>
        </div>
        {artifact.url && (
          <button className="dl-btn" onClick={onPress} title="Download and view the real file">
            {phase === 'downloading' ? (
              <>
                <span className="spinner" /> Loading
              </>
            ) : open ? (
              'Hide'
            ) : (
              '⬇ Open'
            )}
          </button>
        )}
      </div>

      {open && (
        <div className="file-card-body">
          {phase === 'downloading' && (
            <div className="downloading">
              <span className="spinner" />
              <span>Downloading the real {artifact.name} via your GitHub session…</span>
            </div>
          )}

          {phase === 'error' && (
            <div className="dl-strip warn">
              ⚠ Couldn’t download ({error}).{' '}
              <button className="dl-saveas" onClick={retry}>
                Try again
              </button>
            </div>
          )}

          {phase === 'ready' && rec && view && (
            <>
              <div className="art-meta ok">
                ✓ Downloaded the real file{idText && ` · artifact ${idText}`} ·{' '}
                {fmtBytes(rec.downloadedBytes ?? rec.bytes)}
                {view.clipped && (
                  <span className="clip-note">
                    {' '}· showing first {fmtBytes(DISPLAY_LIMIT)} of {fmtBytes(view.total)} — save
                    to disk for the full file
                  </span>
                )}
              </div>

              {/* Save-to-disk with location, existence check + re-download */}
              <div className="save-block">
                {save.state === 'idle' && (
                  <div className="save-row">
                    <button className="dl-btn" onClick={() => saveToDisk(false)}>
                      💾 Save to disk
                    </button>
                    <button className="dl-saveas" onClick={() => saveToDisk(true)}>
                      Save as…
                    </button>
                  </div>
                )}
                {save.state === 'saving' && (
                  <div className="dl-strip">
                    <span className="spinner" /> Saving…
                  </div>
                )}
                {save.state === 'done' && (
                  <div className="dl-strip ok">
                    <div className="dl-saved">
                      ✓ Downloaded to your computer
                      {save.bytes ? ` · ${fmtBytes(save.bytes)}` : ''}
                    </div>
                    {save.path && (
                      <div className="dl-path" title={save.path}>
                        {save.path}
                      </div>
                    )}
                    <div className="dl-followups">
                      <button onClick={showInFolder}>📂 Show in folder</button>
                      <button onClick={openFile}>↗ Open file</button>
                      <button onClick={() => saveToDisk(false)}>⟳ Re-download</button>
                    </div>
                  </div>
                )}
                {save.state === 'missing' && (
                  <div className="dl-strip warn">
                    <div>
                      ⚠ Saved earlier{save.path ? ` to ${savedName(save.path)}` : ''}, but the file
                      is no longer there.
                    </div>
                    <div className="dl-followups">
                      <button onClick={() => saveToDisk(false)}>⟳ Re-download</button>
                    </div>
                  </div>
                )}
                {save.state === 'error' && (
                  <div className="dl-strip warn">
                    ⚠ Save failed ({save.error}).{' '}
                    <button className="dl-saveas" onClick={() => saveToDisk(false)}>
                      Try again
                    </button>
                  </div>
                )}
              </div>

              <pre className="code">{view.text}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
