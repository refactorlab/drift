// Shared visual primitives for the native scan report — all hand-rolled SVG/CSS
// (zero chart dependencies, fully theme-aware). Tone maps a semantic level to a
// theme colour so every gauge, badge and meter reads consistently.

import { useState, type ReactNode } from 'react';
import type { GaugeLevel } from '../../core/scanOutput';

export type Tone = 'good' | 'warn' | 'bad' | 'critical' | 'info' | 'muted';

export function toneVar(tone: Tone): string {
  switch (tone) {
    case 'good':
      return 'var(--drift-good)';
    case 'warn':
      return 'var(--drift-warn)';
    case 'bad':
      return 'var(--drift-bad)';
    case 'critical':
      return 'var(--drift-bad)';
    case 'info':
      return 'var(--drift-info)';
    default:
      return 'var(--drift-fg-muted)';
  }
}

export function toneForLevel(level?: GaugeLevel): Tone {
  switch (level) {
    case 'low':
      return 'good';
    case 'moderate':
      return 'warn';
    case 'high':
      return 'bad';
    case 'critical':
      return 'critical';
    default:
      return 'muted';
  }
}

// ── ArcGauge — a donut dial with a centred value, for headline KPIs ──────────
export function ArcGauge({
  fraction,
  value,
  label,
  tone = 'info',
  size = 76,
}: {
  fraction: number | null;
  value: string;
  label: string;
  tone?: Tone;
  size?: number;
}) {
  const stroke = Math.max(5, Math.round(size * 0.09));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = fraction == null ? 0 : Math.max(0, Math.min(1, fraction));
  const color = toneVar(tone);
  return (
    <div className="rp-arc" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${value}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--drift-track)" strokeWidth={stroke}
        />
        {fraction != null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${f * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        <text
          x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
          className="rp-arc-val" style={{ fill: color, fontSize: size * 0.26 }}
        >
          {value}
        </text>
      </svg>
      <div className="rp-arc-label">{label}</div>
    </div>
  );
}

// ── Meter — a horizontal bar (0..100) with a tone fill ───────────────────────
export function Meter({ percent, tone = 'info' }: { percent: number | null; tone?: Tone }) {
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <div className="rp-meter" aria-hidden>
      <span className="rp-meter-fill" style={{ width: `${p}%`, background: toneVar(tone) }} />
    </div>
  );
}

// ── Badge — a small pill (filled for emphasis) ───────────────────────────────
export function Badge({
  children,
  tone = 'muted',
  filled = false,
}: {
  children: ReactNode;
  tone?: Tone;
  filled?: boolean;
}) {
  const color = toneVar(tone);
  const style = filled
    ? { background: color, color: '#fff', borderColor: 'transparent' }
    : { color, borderColor: color };
  return (
    <span className="rp-badge" style={style}>
      {children}
    </span>
  );
}

// ── Collapsible — a modern disclosure card ───────────────────────────────────
export function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  accent,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  accent?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rp-collapse${open ? ' open' : ''}`} style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <button className="rp-collapse-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`rp-chevron${open ? ' open' : ''}`} aria-hidden>
          ›
        </span>
        <span className="rp-collapse-title">{title}</span>
        {subtitle != null && <span className="rp-collapse-sub">{subtitle}</span>}
      </button>
      {open && <div className="rp-collapse-body">{children}</div>}
    </div>
  );
}

// ── Section — a titled block wrapper ─────────────────────────────────────────
export function Section({ icon, title, action, children }: { icon?: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rp-section">
      <header className="rp-section-head">
        <h3>
          {icon && <span className="rp-section-icon">{icon}</span>}
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}
