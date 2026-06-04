//! React — UI-framework anti-pattern detector. A non-ORM "parallel track"
//! (like `llm` / `auth_crypto`) that shares the TS `PyOrmContext` pipeline but
//! emits correctness/reliability findings specific to React, the dominant
//! front-end framework. Gated by [`matches_react`] so it never fires on plain
//! TypeScript.
//!
//! Rules (each a well-known, statically-detectable React footgun):
//!   - `REACT-EFFECT-ASYNC-001` — `useEffect(async () => …)` /
//!     `useLayoutEffect(async …)`. An `async` effect callback returns a
//!     Promise, so React ignores its return value: the cleanup function never
//!     runs and overlapping runs race. Reliability.
//!   - `REACT-DANGEROUS-HTML-002` — `dangerouslySetInnerHTML`. Injects raw,
//!     unescaped HTML — an XSS sink whenever the value is not sanitised.
//!   - `REACT-HOOK-IN-LOOP-003` — a Hook (`useState`/`useEffect`/`use*`) called
//!     inside a loop or `.map(...)` callback. Violates the Rules of Hooks
//!     (hooks must run in the same order every render) → runtime crash.
//!   - `REACT-INDEX-KEY-004` — `key={i}` / `key={index}` array-index keys.
//!     Break reconciliation on reorder/insert/delete (stale state, lost focus).
//!
//! Detection is over the file source (`ctx.source`) with tight, high-signal
//! patterns, cross-referenced with `ctx.for_loops` for the loop rule. The
//! tokens (`dangerouslySetInnerHTML`, `useEffect(async`) are specific enough
//! that string/comment false positives are negligible, and the `matches_react`
//! gate removes the rest.

use std::ops::Range;
use std::sync::OnceLock;

use regex::Regex;

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::PyOrmContext;
use crate::orm::{Framework, MatchHit, OrmRule};

/// 1-based line for a byte offset into `src`.
fn line_at(src: &str, byte: usize) -> usize {
    let upto = byte.min(src.len());
    src.as_bytes()[..upto].iter().filter(|&&b| b == b'\n').count() + 1
}

fn hit(src: &str, range: Range<usize>, rule_id: &str) -> MatchHit {
    let line = line_at(src, range.start);
    MatchHit {
        line,
        byte_range: range,
        extra_evidence: vec![Evidence {
            call: rule_id.to_string(),
            line,
            category: None,
        }],
    }
}

// ── lazily-compiled patterns ────────────────────────────────────────────────

fn re_async_effect() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\b(?:useEffect|useLayoutEffect)\s*\(\s*async\b").unwrap())
}

fn re_dangerous_html() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\bdangerouslySetInnerHTML\b").unwrap())
}

/// Any Hook call: `use` + UpperCamel + `(`. Matches built-ins (`useState`,
/// `useEffect`, …) and custom hooks (`useAuth`) alike — the `use[A-Z]`
/// convention IS the React contract for what counts as a hook.
fn re_hook_call() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\buse[A-Z]\w*\s*\(").unwrap())
}

/// `key={i}` / `key={index}` / `key={idx}` — array-index keys.
fn re_index_key() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\bkey\s*=\s*\{\s*(?:i|idx|index|n|_i)\s*\}").unwrap())
}

/// Hook-usage probe for the gate (covers React 17+ files that use the
/// automatic JSX transform and so don't `import React`).
fn re_hook_usage() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"\buse(?:State|Effect|Ref|Memo|Callback|Context|Reducer|LayoutEffect)\s*\(")
            .unwrap()
    })
}

/// React-likeness gate: an explicit `react`/`react-dom`/`preact`/`next` import,
/// OR observable hook usage in the source. Keeps the rules off plain TS/JS.
pub fn matches_react(ctx: &PyOrmContext<'_>) -> bool {
    let imported = ctx.imports.modules.keys().any(|m| {
        m == "react"
            || m == "react-dom"
            || m == "preact"
            || m.starts_with("react/")
            || m.starts_with("react-dom/")
            || m.starts_with("next/")
    });
    imported || re_hook_usage().is_match(ctx.source)
}

// ── rule matchers ────────────────────────────────────────────────────────────

fn matches_async_effect(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    re_async_effect()
        .find_iter(ctx.source)
        .map(|m| hit(ctx.source, m.start()..m.end(), "REACT-EFFECT-ASYNC-001"))
        .collect()
}

fn matches_dangerous_html(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    re_dangerous_html()
        .find_iter(ctx.source)
        .map(|m| hit(ctx.source, m.start()..m.end(), "REACT-DANGEROUS-HTML-002"))
        .collect()
}

fn matches_hook_in_loop(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    re_hook_call()
        .find_iter(ctx.source)
        .filter(|m| ctx.is_in_loop(m.start()))
        .map(|m| hit(ctx.source, m.start()..m.end(), "REACT-HOOK-IN-LOOP-003"))
        .collect()
}

fn matches_index_key(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    re_index_key()
        .find_iter(ctx.source)
        .map(|m| hit(ctx.source, m.start()..m.end(), "REACT-INDEX-KEY-004"))
        .collect()
}

pub const REACT_RULES: &[OrmRule] = &[
    OrmRule {
        id: "REACT-EFFECT-ASYNC-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`useEffect`/`useLayoutEffect` callback is `async` — React ignores the returned Promise, so the cleanup function never runs and overlapping effects race.",
        remediation: "Make the effect callback synchronous; define an async function inside it and call it, and `return` a sync cleanup that cancels in-flight work (AbortController / `ignore` flag).",
        confidence: 0.92,
        matches: matches_async_effect,
    },
    OrmRule {
        id: "REACT-DANGEROUS-HTML-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Medium,
        message: "`dangerouslySetInnerHTML` injects raw, unescaped HTML — an XSS sink when the value is user-influenced and not sanitised.",
        remediation: "Render text as children (auto-escaped), or sanitise with a vetted library (DOMPurify) before setting inner HTML.",
        confidence: 0.80,
        matches: matches_dangerous_html,
    },
    OrmRule {
        id: "REACT-HOOK-IN-LOOP-003",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Medium,
        message: "Hook called inside a loop / `.map(...)` callback — violates the Rules of Hooks (hooks must run in the same order on every render).",
        remediation: "Lift the hook to the top level of the component; to render a list, map over data in JSX or extract a child component that calls the hook once.",
        confidence: 0.85,
        matches: matches_hook_in_loop,
    },
    OrmRule {
        id: "REACT-INDEX-KEY-004",
        framework: Framework::Generic,
        severity: Severity::Low,
        effort: Effort::Small,
        message: "Array index used as React `key` — reconciliation breaks on reorder/insert/delete (stale state, lost input focus, wrong DOM reuse).",
        remediation: "Use a stable, item-unique key (an id), not the array index.",
        confidence: 0.65,
        matches: matches_index_key,
    },
];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::ts::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&crate::languages::typescript_xml::language())
            .unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe {
            std::mem::transmute::<&tree_sitter::Tree, &tree_sitter::Tree>(&tree)
        });
        (c, tree)
    }

    fn run(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = REACT_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn gate_matches_on_react_import() {
        let (c, _t) = ctx("import { useState } from 'react';\nexport function A(){return null;}\n");
        assert!(matches_react(&c));
    }

    #[test]
    fn gate_matches_on_hook_usage_without_import() {
        // React 17+ automatic JSX transform: no `import React`.
        let (c, _t) = ctx("export function A(){ const [x,setX]=useState(0); return null; }\n");
        assert!(matches_react(&c));
    }

    #[test]
    fn gate_skips_plain_typescript() {
        let (c, _t) = ctx("export function add(a:number,b:number){ return a+b; }\n");
        assert!(!matches_react(&c));
    }

    #[test]
    fn async_effect_fires() {
        let src = "useEffect(async () => { await load(); }, []);\n";
        assert_eq!(run("REACT-EFFECT-ASYNC-001", src).len(), 1);
    }

    #[test]
    fn async_effect_safe_when_sync() {
        let src = "useEffect(() => { void load(); }, []);\n";
        assert!(run("REACT-EFFECT-ASYNC-001", src).is_empty());
    }

    #[test]
    fn dangerous_html_fires() {
        let src = "return <div dangerouslySetInnerHTML={{ __html: raw }} />;\n";
        assert_eq!(run("REACT-DANGEROUS-HTML-002", src).len(), 1);
    }

    #[test]
    fn hook_in_loop_fires_in_map() {
        // `.map(...)` is tracked as a loop range by the TS context builder.
        let src = "items.map((it) => { const v = useMemoValue(it); return v; });\n";
        let hits = run("REACT-HOOK-IN-LOOP-003", src);
        assert!(!hits.is_empty(), "hook inside .map callback must flag");
    }

    #[test]
    fn hook_at_top_level_is_safe() {
        let src = "function C(){ const v = useState(0); return null; }\n";
        assert!(run("REACT-HOOK-IN-LOOP-003", src).is_empty());
    }

    #[test]
    fn index_key_fires() {
        let src = "{items.map((it, i) => <li key={i}>{it}</li>)}\n";
        assert_eq!(run("REACT-INDEX-KEY-004", src).len(), 1);
    }

    #[test]
    fn stable_key_is_safe() {
        let src = "{items.map((it) => <li key={it.id}>{it.name}</li>)}\n";
        assert!(run("REACT-INDEX-KEY-004", src).is_empty());
    }
}
