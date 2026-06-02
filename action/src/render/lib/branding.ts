// Shared Drift brand chrome — the screenshot banners, the clickable audio
// button, and the Andy sign-off — so every comment surface (the full report in
// overview.ts AND the docs-only notice in no_source.ts) renders the IDENTICAL
// header, audio banner, and sign-off. Previously these lived privately in
// overview.ts and were copied into no_source.ts, which meant a host/width/alt
// change to one silently drifted from the other. Centralised here so both
// import the single source of truth.
//
// Official Drift section-header screenshots (refactorlab/andy/docs/screenshots).
// Fail-soft: GitHub's Camo proxy degrades a missing/404 asset to its `alt` text
// without breaking the comment, so these can ship before the PNGs are committed.

import { escapeHtml } from './format.ts';

export const SCREENSHOTS = 'https://raw.githubusercontent.com/refactorlab/andy/main/docs/screenshots';

// Banner sizing. These brand PNGs are wide hero images; at full width they
// dominate the comment, so every banner is pinned to a small FIXED width
// (height auto-scales). Section banners share BANNER_WIDTH; the audio button is
// the one call-to-action banner so it's pinned WIDER to draw the eye; the Andy
// sign-off is smaller still.
export const BANNER_WIDTH = 120;
export const AUDIO_BANNER_WIDTH = 200;
export const ANDY_WIDTH = 64;

/** A section-header screenshot banner on its own line. */
export const sectionImage = (file: string, alt: string): string =>
  `<p><img src="${SCREENSHOTS}/${file}" alt="${alt}" width="${BANNER_WIDTH}" /></p>`;

/** Prepend a section-header screenshot to a section's markdown (own line, above it). */
export const withImage = (file: string, alt: string, section: string): string =>
  `${sectionImage(file, alt)}\n\n${section}`;

/**
 * Clickable "🔊 audio summary" button banner — the `summary-audio.png`
 * screenshot wrapped in a link to the spoken-summary artifact. `escapeHtml`
 * closes the `href` attribute safely (the URL is env-influenced). Same artifact
 * caveat as the footer's text link (GitHub gates artifact downloads behind a
 * logged-in session even on public repos).
 */
export const audioBanner = (url: string): string =>
  `<p align="center"><a href="${escapeHtml(url)}"><img src="${SCREENSHOTS}/summary-audio.png" alt="🔊 Listen to the spoken summary (Kokoro TTS)" width="${AUDIO_BANNER_WIDTH}" /></a></p>`;

/**
 * Andy sign-off — a small mascot banner pinned to the VERY END of the comment.
 * Kept small (ANDY_WIDTH) so it reads as a sign-off, not a hero banner.
 * Fail-soft to alt text like every other screenshot.
 */
export const andySignoff = (): string =>
  `<p><img src="${SCREENSHOTS}/andy.png" alt="Andy — your PR handoff assistant" width="${ANDY_WIDTH}" /></p>`;
