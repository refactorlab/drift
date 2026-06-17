// The 5 specialized PR-review AGENTS, expressed as LENSES over one shared engine.
//
// Per aider's chat-modes and goose's recipes: the loop, the file retrieval, the
// summarize-under-budget, and the token policy are IDENTICAL across agents — only
// a small per-lens struct differs: the task instruction (system prompt), the
// answer shape, the spoken/visible "action" narration, and a file-selection bias.
// Each lens becomes a routable tool in chatTools.ts (factory: lensTool).

import type { ReadableFile, IterativeLens } from './iterative-agent';

export interface AgentLens extends IterativeLens {
  /** Tool id the router picks (also the tool name). Explicit verb_object so both
   *  the model and a developer can tell what it does from the name alone. */
  id: string;
  /** Clean human label for the tool-step card (no ellipsis), e.g. "Finding
   *  breaking changes". Derived from spokenAction would lose nuance, so explicit. */
  label: string;
  /** One keyword-rich line for the router prompt (the tool doc the model reads). */
  routerDescription: string;
  /** Concrete example user questions that should route here — the router's
   *  trigger rules are generated from these, so they ARE the routing contract. */
  examples: string[];
  /** User-facing capability line (answer to "what can you do"). */
  capability: string;
  /** Short action phrase shown as the first "thinking" line AND spoken by TTS
   *  in voice mode — e.g. "Finding breaking changes…". */
  spokenAction: string;
  /** Fallback tool-card summary when no files were opened. */
  summaryNoun: string;
}

// ── file classifiers (shared) ────────────────────────────────────────────────

const isTest = (p: string): boolean => /(\.|_)(test|spec)\.[tj]sx?$/.test(p) || /(^|\/)__tests__\//.test(p);
const isDocs = (p: string): boolean => /\.mdx?$/.test(p) || /(^|\/)readme/i.test(p);
const isConfig = (p: string): boolean =>
  /\.(json|ya?ml|toml)$/.test(p) || /\.config\.[tj]s$/.test(p) || /(^|\/)(manifest|vite|tsconfig|package)\b/.test(p);
/** API-surface-ish: barrels, type/decl files, public entrypoints. */
const isApiSurface = (p: string): boolean =>
  /(^|\/)index\.[tj]sx?$/.test(p) || /\.d\.ts$/.test(p) || /(^|\/)types?\.[tj]s$/.test(p) || /(^|\/)(api|public)\//.test(p);
const isSource = (p: string): boolean => /\.[tj]sx?$/.test(p) && !isTest(p) && !isConfig(p);
/** Dependency manifests / lockfiles across ecosystems. */
const isDepManifest = (p: string): boolean =>
  /(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|cargo\.(toml|lock)|go\.(mod|sum)|requirements\.txt|pyproject\.toml|gemfile(\.lock)?|composer\.(json|lock))$/i.test(
    p,
  );
/** Paths whose names suggest security-sensitive code (auth, crypto, input). */
const isSecuritySensitive = (p: string): boolean =>
  /(auth|login|signin|session|token|jwt|oauth|crypto|password|secret|credential|permission|sanitiz|validat|cors|csrf|escape)/i.test(
    p,
  );

/** Sort by a per-file score (descending), stable. The score function is the only
 *  thing that differs between lenses' file bias. */
function rankBy(score: (f: ReadableFile) => number): (files: ReadableFile[]) => ReadableFile[] {
  return (files) =>
    files
      .map((f, i) => ({ f, i, s: score(f) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.f);
}

const added = (f: ReadableFile): boolean => f.status === 'A';

// ── the lenses ───────────────────────────────────────────────────────────────

export const LENSES: AgentLens[] = [
  {
    id: 'summarize_pr_features',
    label: 'Summarizing PR features',
    routerDescription:
      'Summarize the MAIN FEATURES / new capabilities this PR delivers (product/user view).',
    examples: ['what does this PR add', 'what are the main features', "what's new in this PR"],
    capability: 'Summarize the main features / new capabilities this PR delivers (summarize_pr_features).',
    spokenAction: 'Summarizing the main features…',
    summaryNoun: 'Summarized features',
    instruction:
      'Summarize what this PR DELIVERS from a user/product view: new capabilities, new public entrypoints/exports, and behavior changes. Lead with newly ADDED files and added exports. Ignore pure refactors, renames, and style-only changes.',
    answerFormat: 'Output a short bulleted list, each line "Feature — one-line description". Cite the file each feature lives in.',
    // New files first, then source; tests/docs/config last.
    rankFiles: rankBy((f) => (added(f) && isSource(f.path) ? 3 : isSource(f.path) ? 2 : isDocs(f.path) ? 1 : 0)),
  },
  {
    id: 'explain_business_logic_changes',
    label: 'Explaining business-logic changes',
    routerDescription:
      'Explain what changed in the BUSINESS LOGIC / rules — conditionals, calculations, validation, state transitions, permissions, money/eligibility.',
    examples: ['what changed in the business logic', 'what behavior changed', 'which rules changed'],
    capability: 'Explain changes to the business logic / decision rules (explain_business_logic_changes).',
    spokenAction: 'Analysing the business-logic changes…',
    summaryNoun: 'Analysed business logic',
    instruction:
      'Focus ONLY on changes to business rules and decision logic — conditionals, calculations, validation, state transitions, permissions, money/eligibility. For each change state the OLD behavior vs the NEW behavior and which inputs change the outcome. Ignore formatting, renames, and plumbing.',
    answerFormat: 'For each change: "<file> — old: … → new: …". End with the net behavioral effect.',
    // Real source (non-test) carries logic; tests/config/docs to the back.
    rankFiles: rankBy((f) => (isSource(f.path) ? 3 : isApiSurface(f.path) ? 2 : isTest(f.path) ? 1 : 0)),
  },
  {
    id: 'find_breaking_changes',
    label: 'Finding breaking changes',
    routerDescription:
      'ONLY backward-incompatible API changes — changed public exports, function/type signatures, routes, config keys, serialized formats. NOT general merge risk (that is assess_merge_risk).',
    examples: ['are there any breaking changes', 'is this backward compatible', 'will this break callers'],
    capability: 'Find breaking / backward-incompatible changes and who they affect (find_breaking_changes).',
    spokenAction: 'Finding breaking changes…',
    summaryNoun: 'Checked breaking changes',
    instruction:
      'Review ONLY for backward-incompatible changes. Inspect changed public exports, function/type signatures, API routes, config keys, and serialized formats. For each breaking change: what broke, who it affects (callers/consumers), and the migration needed. Ignore internal refactors that preserve external behavior.',
    answerFormat:
      'List each breaking change with its file + affected callers + migration. If none, say "No breaking changes detected" and name the exports/signatures you verified.',
    // Public surface + source first.
    rankFiles: rankBy((f) => (isApiSurface(f.path) ? 3 : isSource(f.path) ? 2 : isConfig(f.path) ? 1 : 0)),
  },
  {
    id: 'assess_merge_risk',
    label: 'Assessing merge risk',
    routerDescription:
      'The OVERALL case against approving — every kind of risk/blocker (missing tests, unhandled errors, edge cases, security/perf regressions, risky migrations, large blast radius). Broader than API breakage (that is find_breaking_changes).',
    examples: ["why shouldn't I approve this", 'should I merge this', 'what are the risks'],
    capability: 'Make the case against approving — concrete risks and blockers (assess_merge_risk).',
    spokenAction: 'Assessing the merge risk…',
    summaryNoun: 'Reviewed risks',
    instruction:
      'You are the SKEPTICAL reviewer arguing why this PR should NOT be merged yet. Surface the strongest CONCRETE risks: missing or weakened tests, unhandled errors, edge cases, security/perf regressions, risky migrations, large blast radius. Do not praise the PR.',
    answerFormat: 'Rank risks by severity (highest first), each as "<severity> — <file/area>: concern". End with the single most important blocker.',
    // Tests (missing/weak), config/migrations, and source all matter; bias source+test high.
    rankFiles: rankBy((f) => (isSource(f.path) ? 3 : isTest(f.path) ? 2 : isConfig(f.path) ? 2 : 0)),
  },
  {
    id: 'orient_pr_review',
    label: 'Orienting the review',
    routerDescription:
      'ORIENT a reviewer picking this PR up cold — its one-line purpose, completion STATE (WIP/TODOs), which 2-3 files to read FIRST, and the single riskiest area. NOT a feature list (summarize_pr_features), architecture (explain_architecture), or full risk review (assess_merge_risk).',
    examples: ['where do I start reviewing', "what's the state of this PR", 'what should I look at first'],
    capability: 'Orient a reviewer — the PR\'s state and where to start reading (orient_pr_review).',
    spokenAction: 'Orienting the review…',
    summaryNoun: 'Oriented the review',
    instruction:
      'ORIENT someone reviewing this PR cold. Be concise and do NOT list every feature, redo the architecture, or tour every file. Give exactly: (1) one line on what this PR is, (2) its completion STATE — does it look WIP/draft, are there obvious TODOs/stubs/incomplete bits, (3) the 2-3 files to read FIRST and why, (4) the single riskiest area to scrutinize.',
    answerFormat: 'Four short labelled parts: "What it is", "State", "Read first" (2-3 files), "Watch out" (one area). Cite file paths.',
    // Start at entrypoints, then real source; config/docs last.
    rankFiles: rankBy((f) => (isApiSurface(f.path) ? 3 : isSource(f.path) ? 2 : 0)),
  },
  {
    id: 'assess_test_coverage',
    label: 'Assessing test coverage',
    routerDescription:
      'Whether the changes are TESTED — which tests were added/changed and which changed SOURCE is left uncovered. NOT general risk (that is assess_merge_risk).',
    examples: ['is this tested', 'how is the test coverage', "what's not tested"],
    capability: "Assess test coverage — what's tested and which changed code is left uncovered (assess_test_coverage).",
    spokenAction: 'Assessing the test coverage…',
    summaryNoun: 'Checked test coverage',
    instruction:
      'Assess whether this PR\'s changes are covered by tests. Identify the test files added/changed and what they exercise, then call out changed SOURCE files that have NO corresponding test and the edge cases left untested.',
    answerFormat: 'List tested areas (with the test file) then untested/under-tested changed files. End with the biggest coverage gap.',
    // Need BOTH tests and the source they cover; bias both high.
    rankFiles: rankBy((f) => (isTest(f.path) ? 3 : isSource(f.path) ? 2 : 0)),
  },
  {
    id: 'review_security_issues',
    label: 'Reviewing security issues',
    routerDescription:
      'SECURITY review — injection (SQL/command/XSS), broken auth/authz, hardcoded secrets, missing input validation, unsafe deserialization, data exposure.',
    examples: ['are there security issues', 'is this safe', 'any vulnerabilities'],
    capability: 'Review for security issues — injection, auth, secrets, validation (review_security_issues).',
    spokenAction: 'Reviewing for security issues…',
    summaryNoun: 'Reviewed security',
    instruction:
      'Review ONLY for security concerns introduced by this PR: injection (SQL/command/XSS), broken authentication/authorization, hardcoded secrets or credentials, missing input validation/sanitization, unsafe deserialization, sensitive-data exposure, and insecure network/crypto use. For each: the risk, the file area, and the fix.',
    answerFormat: 'List each issue with severity + file + remediation. If none found, say so and name what you checked.',
    rankFiles: rankBy((f) => (isSecuritySensitive(f.path) ? 3 : isSource(f.path) ? 2 : isConfig(f.path) ? 1 : 0)),
  },
  {
    id: 'assess_performance_impact',
    label: 'Assessing performance impact',
    routerDescription:
      'PERFORMANCE impact — new nested loops, N+1 or heavy queries/network calls, large allocations, blocking work on hot paths, added render/recompute cost, big-O regressions.',
    examples: ['what is the performance impact', 'is this slow', 'any perf regressions'],
    capability: 'Assess performance impact — hot paths, loops, queries, regressions (assess_performance_impact).',
    spokenAction: 'Assessing the performance impact…',
    summaryNoun: 'Assessed performance',
    instruction:
      'Assess the performance impact of this PR. Look for new nested loops, repeated/N+1 queries or network calls, large allocations, synchronous/blocking work on hot paths, and added render/recompute cost. State whether each sits on a hot path and the likely impact.',
    answerFormat: 'List each concern with the file + why it costs + whether it is hot-path. If impact is negligible, say so.',
    rankFiles: rankBy((f) => (isSource(f.path) ? 3 : isApiSurface(f.path) ? 1 : 0)),
  },
  {
    id: 'review_dependency_changes',
    label: 'Reviewing dependency changes',
    routerDescription:
      'DEPENDENCY changes — added/removed/upgraded packages, lockfile/manifest edits, new third-party imports, and their risk (major bumps, heavy/unmaintained packages).',
    examples: ['what dependencies changed', 'any new packages', 'what changed in package.json'],
    capability: 'Review dependency / package changes and their risk (review_dependency_changes).',
    spokenAction: 'Reviewing the dependency changes…',
    summaryNoun: 'Reviewed dependencies',
    instruction:
      'Review changes to dependencies: added, removed, or version-bumped packages in manifests/lockfiles, plus new third-party imports in the code. Flag risky upgrades (major version bumps), heavy or unmaintained packages, and duplicated functionality.',
    answerFormat: 'List each dependency change (name, old→new where known) with a risk note. If there are none, say there are no dependency changes.',
    rankFiles: rankBy((f) => (isDepManifest(f.path) ? 3 : isConfig(f.path) ? 1 : 0)),
  },
  {
    id: 'suggest_improvements',
    label: 'Suggesting improvements',
    routerDescription:
      'NON-BLOCKING improvement suggestions for the changed code — clearer names, simpler structure, dead code, missed reuse, readability. Nice-to-haves, NOT blockers (assess_merge_risk) and NOT security (review_security_issues).',
    examples: ['how can this be improved', 'any suggestions', 'what could be cleaner'],
    capability: 'Suggest non-blocking improvements — readability, simplification, reuse (suggest_improvements).',
    spokenAction: 'Looking for improvements…',
    summaryNoun: 'Suggested improvements',
    instruction:
      'Suggest concrete, NON-BLOCKING improvements to the changed code: clearer names, simpler structure, dead/duplicate code, missed reuse, readability. These are nice-to-haves — do NOT report bugs, risks, or security issues. For each: the file + the suggestion + why it helps.',
    answerFormat: 'Bulleted list, each "<file> — suggestion (why)". If the code is already clean, say so.',
    rankFiles: rankBy((f) => (isSource(f.path) ? 3 : isApiSurface(f.path) ? 1 : 0)),
  },
  {
    id: 'check_code_conventions',
    label: 'Checking code conventions',
    routerDescription:
      'CONSISTENCY with the existing codebase — naming, file/module structure, import style, error/logging patterns, formatting idioms. Compares new code to the surrounding patterns. NOT overall quality or risk.',
    examples: ['does this follow our conventions', 'is this consistent with the codebase', 'does it match the existing style'],
    capability: 'Check consistency with the codebase conventions and patterns (check_code_conventions).',
    spokenAction: 'Checking code conventions…',
    summaryNoun: 'Checked conventions',
    instruction:
      'Check whether the changed code follows the EXISTING codebase conventions — naming, file/module structure, import style, error/logging patterns, and formatting idioms — by comparing new code against the patterns visible in the changed files. Flag deviations. Do NOT judge overall quality, bugs, or risk.',
    answerFormat: 'List each deviation with the file + the established pattern it breaks. If consistent, say so.',
    rankFiles: rankBy((f) => (isSource(f.path) ? 3 : isApiSurface(f.path) ? 2 : 0)),
  },
  {
    id: 'review_error_handling',
    label: 'Reviewing error handling',
    routerDescription:
      'How the change handles ERRORS and EDGE CASES — try/catch coverage, error propagation, null/undefined/empty handling, boundary conditions, failure/timeout paths, silent catches. Narrower than overall risk (assess_merge_risk).',
    examples: ['how does this handle errors', 'are edge cases handled', 'what happens on failure'],
    capability: 'Review error handling and edge cases — failure paths, null/empty, silent catches (review_error_handling).',
    spokenAction: 'Reviewing error handling…',
    summaryNoun: 'Reviewed error handling',
    instruction:
      'Review ONLY how this PR handles errors and edge cases: try/catch coverage, error propagation, null/undefined/empty handling, boundary conditions, failure/timeout paths, and silently-swallowed errors. For each gap: the file + the unhandled case + the consequence. This is NOT a general risk review.',
    answerFormat: 'List each gap with file + the unhandled case + the consequence. If error handling looks solid, say so.',
    rankFiles: rankBy((f) => (isSource(f.path) ? 3 : 0)),
  },
];

export function findLens(id: string): AgentLens | undefined {
  return LENSES.find((l) => l.id === id);
}
