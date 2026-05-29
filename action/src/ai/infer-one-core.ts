// Core orchestration for a single per-suggestion inference call.
//
// Extracted from `ai-infer-one.ts` so it can be exercised without
// process.argv / process.env / module top-level side effects: tests
// import `inferOne(deps)` directly and inject a stubbed fetch via
// `callModel`. The CLI entry point (`ai-infer-one.ts`) reads the env,
// builds the deps, and calls this — keeping a single source of truth
// for the read-modify-write envelope semantics + diagnostic logs.
//
// Why a separate file: the bundle (`dist/ai-infer-one.js`) calls main()
// at module load. If the test imported the .ts that auto-runs main(),
// importing for any reason would trigger an inference call. Pulling the
// logic into a side-effect-free module avoids that footgun.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as core from '@actions/core';
import { loadReport, type ScanPrOutput } from '../report.ts';
import { buildFocalUserPrompt, FOCAL_SYSTEM_PROMPT } from './focal-prompt.ts';
import {
  getFullDiff,
  commentableLinesByFile,
  lookupCommentable,
  pickFocalSuggestions,
} from './build-context.ts';
import { callModel as defaultCallModel } from './models-client.ts';
import { parseAIOutput } from './parse.ts';
import type { AISuggestionEnvelope } from './schema.ts';

/**
 * Subset of the @actions/core surface we use, narrowed so the tests can
 * inject a capturing logger without monkey-patching the module's
 * non-configurable namespace exports. Defaults to the production
 * `core.*` calls so callers never see the abstraction.
 */
export type InferLogger = {
  info(msg: string): void;
  warning(msg: string): void;
  startGroup(name: string): void;
  endGroup(): void;
};

/**
 * All inputs an inference call needs, EXPLICIT (no env, no argv). Pure
 * dependency injection so tests can drive every code path
 * deterministically without subprocess overhead.
 *
 * `callModel` is injectable so unit tests stub the HTTP layer without
 * monkey-patching `globalThis.fetch`. Subprocess E2E tests leave it
 * undefined and hit a local stub HTTP server instead. `logger` is
 * injectable for the same reason: tests assert on captured messages.
 */
export type InferOneDeps = {
  idx: number;
  outPath: string;
  reportPath: string;
  endpoint: string;
  model: string;
  token: string;
  workspaceRoot: string;
  baseSha: string;
  headSha: string;
  maxOutputTokens: number;
  callModel?: typeof defaultCallModel;
  logger?: InferLogger;
};

const defaultLogger: InferLogger = {
  info: (m) => core.info(m),
  warning: (m) => core.warning(m),
  startGroup: (n) => core.startGroup(n),
  endGroup: () => core.endGroup(),
};

function readEnvelope(path: string): AISuggestionEnvelope {
  try {
    if (existsSync(path)) {
      const j = JSON.parse(readFileSync(path, 'utf8')) as AISuggestionEnvelope;
      if (Array.isArray(j?.suggestions)) return j;
    }
  } catch {
    // fall through to a fresh envelope
  }
  return { suggestions: [] };
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Run inference for ONE focal point. Always exits without throwing —
 * any failure is logged and swallowed so a single bad finding never
 * sinks the others (the bash loop runs this N times sequentially and
 * the deterministic review has already shipped).
 */
export async function inferOne(deps: InferOneDeps): Promise<void> {
  const {
    idx,
    outPath,
    reportPath,
    endpoint,
    model,
    token,
    workspaceRoot,
    baseSha,
    headSha,
    maxOutputTokens,
    callModel = defaultCallModel,
    logger = defaultLogger,
  } = deps;
  const log = logger;

  const label = Number.isInteger(idx) ? `#${idx + 1}` : '?';

  if (!Number.isInteger(idx) || idx < 0) {
    log.warning(`ai-infer-one: bad focal index "${idx}".`);
    return;
  }
  if (!outPath || !endpoint || !token) {
    log.warning('ai-infer-one: missing AI_OUT / AI_ENDPOINT / GITHUB_TOKEN.');
    return;
  }
  if (!existsSync(reportPath)) {
    log.warning(`ai-infer-one: no report at ${reportPath}.`);
    return;
  }

  let report: ScanPrOutput;
  try {
    report = loadReport(reportPath);
  } catch (e) {
    log.warning(`ai-infer-one: report unreadable: ${describe(e)}`);
    return;
  }

  // File-level commentable filter (see pickFocalSuggestions for the why).
  const fullDiff = getFullDiff(workspaceRoot, baseSha, headSha);
  const commentable = fullDiff ? commentableLinesByFile(fullDiff) : undefined;

  // Up-front breadcrumb: name the scanner-flagged location + the diff
  // surface so every later log can be read against this anchor.
  const allFindings = pickFocalSuggestions(report, Number.MAX_SAFE_INTEGER);
  const anchorable = commentable
    ? pickFocalSuggestions(report, Number.MAX_SAFE_INTEGER, commentable).length
    : allFindings.length;
  const focal = allFindings[idx];
  if (focal) {
    const fnTag = focal.function ? ` ${focal.function}` : '';
    const ruleTag =
      (focal as { rule_id?: string }).rule_id
        ? ` [${(focal as { rule_id?: string }).rule_id}]`
        : '';
    log.info(
      `focal ${label}: ${focal.file}:${focal.line ?? '?'}${fnTag}${ruleTag}` +
        ` · cohort ${anchorable}/${allFindings.length} anchorable` +
        ` · diff covers ${commentable ? commentable.size : 0} file(s)`,
    );
  }

  const user = buildFocalUserPrompt(
    report,
    idx,
    { workspaceRoot, baseSha, headSha },
    commentable,
  );
  if (!user) {
    if (idx >= allFindings.length) {
      log.info(
        `focal ${label}: only ${allFindings.length} scanner finding(s) — index out of range.`,
      );
    } else {
      const f = allFindings[idx];
      const where = `${f.file}:${f.line ?? '?'}`;
      if (!commentable) {
        log.info(`focal ${label}: ${where} — PR diff unavailable, cannot anchor.`);
      } else {
        const set = lookupCommentable(commentable, f.file);
        if (!set) {
          const sample = [...commentable.keys()].slice(0, 5).join(', ');
          const more = commentable.size > 5 ? ` (+${commentable.size - 5} more)` : '';
          log.info(
            `focal ${label}: ${where} — file not present on the PR diff` +
              ` (path-base mismatch?). Diff has ${commentable.size} file(s): ${sample}${more}.`,
          );
        } else if (set.size === 0) {
          log.info(
            `focal ${label}: ${where} — file is on the diff but has zero commentable lines.`,
          );
        } else {
          log.info(
            `focal ${label}: ${where} — skipped (unknown reason; ${set.size} commentable line(s) in file).`,
          );
        }
      }
    }
    return;
  }

  const windowSource = user.includes('code window (scanner') ? 'scanner' : 'HEAD';
  log.info(
    `focal ${label}: prompt built (${user.length} chars, window=${windowSource}) → calling model…`,
  );

  let content: string;
  try {
    content = await callModel({
      endpoint,
      token,
      model,
      system: FOCAL_SYSTEM_PROMPT,
      user,
      maxOutputTokens,
    });
  } catch (e) {
    log.warning(`focal ${label}: inference failed (${describe(e)}).`);
    return;
  }

  const parsed = parseAIOutput(content);
  if (!parsed.ok) {
    log.warning(`focal ${label}: output rejected — ${parsed.reason}`);
    log.startGroup(`focal ${label}: model exchange (rejected)`);
    log.info(`── INPUT (user prompt) ──\n${user}`);
    log.info(`── OUTPUT (model reply, first 400 chars) ──\n${parsed.rawPreview}`);
    log.endGroup();
    return;
  }
  const suggestion = parsed.suggestions[0];
  if (!suggestion) {
    log.info(`focal ${label}: ${parsed.total} candidate(s) → 0 cleared the bar.`);
    return;
  }

  // Sequential bash loop ⇒ no concurrent writers ⇒ plain read-append-write.
  const envelope = readEnvelope(outPath);
  envelope.suggestions.push(suggestion);
  writeFileSync(outPath, JSON.stringify(envelope));
  log.info(`focal ${label}: +1 suggestion → ${suggestion.file}:${suggestion.line}`);
}
