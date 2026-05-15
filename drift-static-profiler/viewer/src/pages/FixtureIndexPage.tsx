import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FIXTURES } from '../fixtures';
import { invalidateUserScans, useUserScans } from '../userScans';
import { invalidateScanCache } from './useReport';
import type { FixtureSpec } from '../types';

/**
 * Landing page at `/`. Renders one clickable card per available
 * fixture JSON. Each card links straight to that fixture's full Scan
 * Report page — the new dedicated `/scan/:fixtureKey/report` route.
 *
 * Two card sections: built-in `FIXTURES` (the language demos shipped
 * with the repo) and user scans (each `make scan /some/path` writes
 * one entry to `viewer/public/fixtures/scans/index.json`, picked up
 * here via `useUserScans`).
 */
export function FixtureIndexPage() {
  const { scans, loading } = useUserScans();
  // Hidden-after-delete set so deletes feel instant — the parent hook
  // doesn't re-fetch until `invalidateUserScans()` + a remount, and we
  // can't easily force its internal state to refresh mid-render.
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  // Bump on every delete so the user can also force a list refresh
  // implicitly (the index endpoint is cheap; no harm in re-fetching).
  // The hook itself doesn't expose a refetch; this is a soft refresh.
  const [, force] = useState(0);
  const handleDeleted = (key: string) => {
    setDeletedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    invalidateUserScans();
    // Drop the cached summary + lazy entries for this scan so a re-create
    // with the same key (rare, but possible via the import path) won't
    // hand the dashboard stale data on the next open.
    invalidateScanCache(key);
    force((n) => n + 1);
  };
  const visibleScans = scans.filter((s) => !deletedKeys.has(s.key));
  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={brandStyle}>drift · static profiler</div>
        <div style={subStyle}>
          Each scan JSON is a separate page. Pick one to open its full report.
        </div>
      </header>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          your scans
          <span style={sectionCountStyle}>
            {loading ? '…' : `${scans.length}`}
          </span>
        </div>
        {visibleScans.length === 0 ? (
          <div style={emptyStyle}>
            No scans yet. Run <code style={codeStyle}>make scan /path/to/your-project</code>
            {' '}from the <code style={codeStyle}>drift-static-profiler/</code> directory.
            Each scan lands as its own card here, named after the folder.
          </div>
        ) : (
          <div style={gridStyle}>
            {visibleScans.map((f) => (
              <ScanCard
                key={f.key}
                f={f}
                kindLabel="SCAN"
                onDeleted={() => handleDeleted(f.key)}
              />
            ))}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          built-in fixtures
          <span style={sectionCountStyle}>{FIXTURES.length}</span>
        </div>
        <div style={gridStyle}>
          {FIXTURES.map((f) => (
            <ScanCard key={f.key} f={f} kindLabel="FIXTURE" />
          ))}
        </div>
      </section>

      <footer style={footerStyle}>
        Looking for the in-tab dashboard? Open{' '}
        <Link to="/scan/python-fastapi" style={linkStyle}>/scan/&lt;key&gt;</Link>{' '}
        directly. Every route works refresh-safely and back-button-safely.
      </footer>
    </div>
  );
}

function ScanCard({
  f,
  kindLabel,
  onDeleted,
}: {
  f: FixtureSpec;
  kindLabel: string;
  /// When provided, renders an inline-confirm delete button in the
  /// card's top-right corner. The handler is responsible for re-fetching
  /// or otherwise reflecting that the scan is gone. Built-in fixtures
  /// omit this prop — they aren't user data and shouldn't be deletable.
  onDeleted?: () => void;
}) {
  return (
    <div style={cardContainerStyle}>
      <Link
        to={`/scan/${f.key}/report`}
        style={cardStyle}
        title={`Open the full scan report for ${f.label}`}
      >
        <div style={cardKindStyle}>{kindLabel}</div>
        <div style={cardLabelStyle}>{f.label}</div>
        <div style={cardDescStyle}>{f.description}</div>
        <div style={cardFooterStyle}>
          <span style={cardPathStyle}>{f.json}</span>
          <span style={cardArrowStyle}>→</span>
        </div>
      </Link>
      {onDeleted && <ScanCardDeleteButton scanKey={f.key} onDeleted={onDeleted} />}
    </div>
  );
}

/// Two-step inline-confirm delete button overlaid on a scan card. First
/// click → red, label changes to "Confirm?"; second click within 3 s →
/// `DELETE /api/scans/{key}` then notify parent. Wrapped in its own
/// component so the `Link` parent's click handler is fully bypassed
/// (`stopPropagation` + `preventDefault`) and the user can't accidentally
/// navigate away mid-confirm.
function ScanCardDeleteButton({
  scanKey,
  onDeleted,
}: {
  scanKey: string;
  onDeleted: () => void;
}) {
  type Phase = 'idle' | 'armed' | 'pending' | 'error';
  const [phase, setPhase] = useState<Phase>('idle');
  const revertTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (revertTimer.current !== null) window.clearTimeout(revertTimer.current);
    };
  }, []);

  const onClick = async (e: React.MouseEvent) => {
    // Stop the parent <Link> from navigating to /scan/.../report.
    e.preventDefault();
    e.stopPropagation();

    if (phase === 'pending') return;
    if (phase === 'idle' || phase === 'error') {
      setPhase('armed');
      if (revertTimer.current !== null) window.clearTimeout(revertTimer.current);
      revertTimer.current = window.setTimeout(() => {
        setPhase('idle');
        revertTimer.current = null;
      }, 3000);
      return;
    }
    // Confirmed.
    if (revertTimer.current !== null) {
      window.clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }
    setPhase('pending');
    try {
      const r = await fetch(`/api/scans/${encodeURIComponent(scanKey)}`, {
        method: 'DELETE',
      });
      if (!r.ok && r.status !== 204) {
        throw new Error(`DELETE /api/scans/${scanKey} → HTTP ${r.status}`);
      }
      onDeleted();
    } catch {
      setPhase('error');
    }
  };

  const label =
    phase === 'pending'
      ? 'Deleting…'
      : phase === 'armed'
        ? '⚠ Click again'
        : phase === 'error'
          ? 'Retry delete'
          : 'Delete';
  const style =
    phase === 'armed' || phase === 'error'
      ? cardDeleteArmedStyle
      : phase === 'pending'
        ? cardDeletePendingStyle
        : cardDeleteIdleStyle;
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      disabled={phase === 'pending'}
      title={
        phase === 'armed'
          ? 'Click again within 3 s to confirm — or wait to cancel.'
          : 'Permanently delete this scan from ~/.drift/scans/.'
      }
    >
      {label}
    </button>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#1e1f22',
  color: '#d7d9dc',
  padding: '32px 24px',
};
const headerStyle: React.CSSProperties = {
  maxWidth: 1200, margin: '0 auto 22px',
};
const sectionStyle: React.CSSProperties = {
  maxWidth: 1200, margin: '0 auto 28px',
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#9ca0a8',
  textTransform: 'uppercase', letterSpacing: 0.8,
  margin: '0 0 10px',
  display: 'flex', alignItems: 'center', gap: 8,
};
const sectionCountStyle: React.CSSProperties = {
  background: '#2a2c30', color: '#7e8189',
  padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600,
};
const emptyStyle: React.CSSProperties = {
  background: '#26282c', border: '1px dashed #3f4147', borderRadius: 6,
  padding: '14px 16px', color: '#9ca0a8', fontSize: 13, lineHeight: 1.6,
};
const codeStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace', fontSize: 12,
  background: '#1e1f22', color: '#d7d9dc',
  padding: '1px 5px', borderRadius: 3, border: '1px solid #3f4147',
};
const brandStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, color: '#d7d9dc', letterSpacing: 0.4,
};
const subStyle: React.CSSProperties = {
  fontSize: 13, color: '#9ca0a8', marginTop: 4,
};
const gridStyle: React.CSSProperties = {
  display: 'grid',
  maxWidth: 1200, margin: '0 auto',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 14,
};
const cardContainerStyle: React.CSSProperties = {
  // Wrapper so the absolutely-positioned delete button has a relative
  // anchor without breaking the existing card layout.
  position: 'relative',
};
const cardStyle: React.CSSProperties = {
  display: 'block',
  textDecoration: 'none',
  color: 'inherit',
  background: '#26282c',
  border: '1px solid #3f4147',
  borderRadius: 6,
  padding: 16,
  transition: 'border-color 120ms',
};
const cardDeleteBaseStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  padding: '3px 9px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
  borderRadius: 100,
  border: '1px solid #3f4147',
  background: 'rgba(38, 40, 44, 0.85)',
  color: '#9ca0a8',
  cursor: 'pointer',
  transition: 'background 120ms, color 120ms, border-color 120ms',
  // Above the Link's z-context so clicks reach the button.
  zIndex: 1,
};
const cardDeleteIdleStyle: React.CSSProperties = {
  ...cardDeleteBaseStyle,
};
const cardDeleteArmedStyle: React.CSSProperties = {
  ...cardDeleteBaseStyle,
  background: '#5b1d1d',
  borderColor: '#e26d6d',
  color: '#ffd6d6',
};
const cardDeletePendingStyle: React.CSSProperties = {
  ...cardDeleteBaseStyle,
  background: '#2f3136',
  color: '#7e8189',
  cursor: 'progress',
};
const cardKindStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: '#7e8189',
  textTransform: 'uppercase', letterSpacing: 0.5,
};
const cardLabelStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 600, color: '#d7d9dc', marginTop: 4,
};
const cardDescStyle: React.CSSProperties = {
  fontSize: 12, color: '#9ca0a8', marginTop: 8, lineHeight: 1.5,
};
const cardFooterStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginTop: 14, paddingTop: 10, borderTop: '1px solid #2f3136',
};
const cardPathStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#5f626a',
};
const cardArrowStyle: React.CSSProperties = {
  fontSize: 14, color: '#5b8def',
};
const footerStyle: React.CSSProperties = {
  maxWidth: 1200, margin: '24px auto 0',
  fontSize: 11, color: '#7e8189',
};
const linkStyle: React.CSSProperties = {
  color: '#5b8def', textDecoration: 'underline',
};
