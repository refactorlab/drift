//! LLM / AI workload perf antipatterns.
//!
//! Phase 1 of the parallel LLM track:
//! - `LLM-CLI-001` — `OpenAI()` / `AsyncOpenAI()` / `Anthropic()`
//!   constructed inside a request handler (instead of module scope).
//! - `LLM-LOOP-002` — `client.chat.completions.create(...)` inside a
//!   loop without batching.
//! - `LLM-SYNC-003` — Synchronous LLM call inside an `async def` handler.
//! - `LLM-CACHE-004` — Anthropic `messages.create(...)` without
//!   `cache_control` on a system prompt that looks long-lived.

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{CallChain, ChainRoot, PyOrmContext};
use crate::orm::{Framework, MatchHit, OrmRule};

fn hit(chain: &CallChain, note: &str) -> MatchHit {
    MatchHit {
        line: chain.steps.last().map(|s| s.line).unwrap_or(1),
        byte_range: chain.byte_range.clone(),
        extra_evidence: vec![Evidence {
            call: note.to_string(),
            line: chain.steps.last().map(|s| s.line).unwrap_or(1),
            category: None,
        }],
    }
}

fn first_method(chain: &CallChain) -> &str {
    chain.steps.first().map(|s| s.method.as_str()).unwrap_or("")
}

fn last_method(chain: &CallChain) -> &str {
    chain.steps.last().map(|s| s.method.as_str()).unwrap_or("")
}

fn root_text(chain: &CallChain) -> String {
    match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => String::new(),
    }
}

fn is_llm_client_ctor(chain: &CallChain) -> bool {
    let r = root_text(chain);
    let m = first_method(chain);
    let last = last_method(chain);
    let names = [
        "OpenAI",
        "AsyncOpenAI",
        "Anthropic",
        "AsyncAnthropic",
        "Cohere",
        "Mistral",
        "Together",
    ];
    names.iter().any(|n| r == *n || m == *n || last == *n)
}

fn is_llm_completion_call(chain: &CallChain) -> bool {
    let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
    // Common shapes: `client.chat.completions.create(...)`,
    // `client.messages.create(...)`, `client.responses.create(...)`,
    // `openai.ChatCompletion.create(...)`.
    methods.iter().any(|m| *m == "create" || *m == "stream")
        && methods
            .iter()
            .any(|m| *m == "chat" || *m == "completions" || *m == "messages" || *m == "responses")
}

// ─── LLM-CLI-001: client construction inside handler ────────────────────
//
// Heuristic: construction chain is in_loop (will be re-constructed each
// iteration) OR inside an async def whose body contains another LLM call
// referencing the same binding — Phase 1 just flags in-loop construction.

fn matches_llm_cli_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if is_llm_client_ctor(chain) {
            out.push(hit(chain, "LLM-CLI-001"));
        }
    }
    out
}

// ─── LLM-LOOP-002: completion call in loop ──────────────────────────────

fn matches_llm_loop_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if is_llm_completion_call(chain) {
            out.push(hit(chain, "LLM-LOOP-002"));
        }
    }
    out
}

// ─── LLM-SYNC-003: sync LLM call in async handler ───────────────────────
//
// Detection (v0.6 — properly implemented):
// 1. Identify variables bound to a SYNC LLM client constructor
//    (`OpenAI()`, `Anthropic()`, …). The sync variants — NOT
//    `AsyncOpenAI` / `AsyncAnthropic`.
// 2. For every LLM completion call (e.g. `<client>.chat.completions
//    .create(...)`) check that its chain root resolves to one of those
//    sync bindings AND its byte offset is inside an `async def`
//    function body.

fn matches_llm_sync_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    // Map each binding name to whether it holds a sync (vs async)
    // client. We track by chain LHS — scan the source prefix of each
    // construction chain.
    let mut sync_client_names: std::collections::HashSet<String> = Default::default();
    for chain in &ctx.chains {
        let r = root_text(chain);
        let last = last_method(chain);
        let first = first_method(chain);
        // Sync constructors: bare `OpenAI(...)` / `Anthropic(...)`.
        let is_sync_ctor = matches!(r.as_str(), "OpenAI" | "Anthropic" | "Cohere" | "Mistral")
            || matches!(first, "OpenAI" | "Anthropic" | "Cohere" | "Mistral")
            || matches!(last, "OpenAI" | "Anthropic" | "Cohere" | "Mistral");
        let is_async_ctor = matches!(r.as_str(), "AsyncOpenAI" | "AsyncAnthropic")
            || matches!(first, "AsyncOpenAI" | "AsyncAnthropic")
            || matches!(last, "AsyncOpenAI" | "AsyncAnthropic");
        if !is_sync_ctor || is_async_ctor {
            continue;
        }
        // Find LHS binding at the same byte range.
        for (name, binds) in &ctx.bindings {
            if binds.iter().any(|b| b.byte_range == chain.byte_range) {
                sync_client_names.insert(name.clone());
            }
        }
    }
    if sync_client_names.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !is_llm_completion_call(chain) {
            continue;
        }
        let r = root_text(chain);
        if !sync_client_names.contains(&r) {
            continue;
        }
        if !ctx.in_async_function(chain.byte_range.start) {
            continue;
        }
        out.push(hit(chain, "LLM-SYNC-003"));
    }
    out
}

// ─── LLM-CACHE-004: Anthropic messages.create without cache_control ─────

fn matches_llm_cache_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        let is_anthropic = methods.iter().any(|m| *m == "messages")
            && methods.last() == Some(&"create");
        if !is_anthropic {
            continue;
        }
        let has_cache = chain.steps.iter().any(|step| {
            step.args_text
                .iter()
                .any(|a| a.contains("cache_control"))
        });
        let has_system = chain.steps.iter().any(|step| {
            step.args_text.iter().any(|a| a.contains("system="))
        });
        if has_system && !has_cache {
            out.push(hit(chain, "LLM-CACHE-004"));
        }
    }
    out
}

pub const LLM_RULES: &[OrmRule] = &[
    OrmRule {
        id: "LLM-CLI-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "LLM client constructed inside a loop — re-creates HTTP pool on every iteration.",
        remediation: "Construct the client once at module scope (or via dependency injection). For per-tenant keys, cache by tenant.",
        confidence: 0.90,
        matches: matches_llm_cli_001,
    },
    OrmRule {
        id: "LLM-LOOP-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Medium,
        message: "LLM completion call inside a loop — serial latency × N requests.",
        remediation: "Batch via the Batch API, run in parallel with `asyncio.gather(...)`, or use a vendor's `n>1` parameter.",
        confidence: 0.85,
        matches: matches_llm_loop_002,
    },
    OrmRule {
        id: "LLM-SYNC-003",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Trivial,
        message: "Sync LLM client (`OpenAI` / `Anthropic`) used inside an async context — blocks the event loop.",
        remediation: "Use `AsyncOpenAI` / `AsyncAnthropic` and `await` the call.",
        confidence: 0.80,
        matches: matches_llm_sync_003,
    },
    OrmRule {
        id: "LLM-CACHE-004",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "Anthropic `messages.create(system=..., ...)` without `cache_control` — pays for the full prompt on every call.",
        remediation: "Add `cache_control={'type': 'ephemeral'}` to the system block to cache the static prefix.",
        confidence: 0.75,
        matches: matches_llm_cache_004,
    },
];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::python::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&tree_sitter_python::LANGUAGE.into())
            .unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe { std::mem::transmute(&tree) });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = LLM_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn llm_cli_001_fires_for_openai_in_loop() {
        let src = "for r in requests:\n    client = OpenAI()\n    client.chat.completions.create(model='gpt-4o', messages=[])\n";
        let hits = run_rule("LLM-CLI-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn llm_loop_002_fires_on_completion_in_loop() {
        let src = "client = OpenAI()\nfor item in items:\n    client.chat.completions.create(model='gpt-4o', messages=[{'role':'user','content':item}])\n";
        let hits = run_rule("LLM-LOOP-002", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn llm_sync_003_fires_on_sync_client_in_async_function() {
        let src = "client = OpenAI()\nasync def handler(req):\n    client.chat.completions.create(model='gpt-4o', messages=[])\n";
        let hits = run_rule("LLM-SYNC-003", src);
        assert!(!hits.is_empty(), "sync OpenAI inside async def must fire LLM-SYNC-003");
    }

    #[test]
    fn llm_sync_003_does_not_fire_for_async_client() {
        let src = "client = AsyncOpenAI()\nasync def handler(req):\n    await client.chat.completions.create(model='gpt-4o', messages=[])\n";
        let hits = run_rule("LLM-SYNC-003", src);
        assert!(hits.is_empty(), "AsyncOpenAI in async fn must NOT fire");
    }

    #[test]
    fn llm_sync_003_does_not_fire_in_sync_function() {
        let src = "client = OpenAI()\ndef handler(req):\n    client.chat.completions.create(model='gpt-4o', messages=[])\n";
        let hits = run_rule("LLM-SYNC-003", src);
        assert!(hits.is_empty(), "sync client in SYNC function must NOT fire (no async boundary crossed)");
    }

    #[test]
    fn llm_cache_004_fires_when_system_without_cache_control() {
        let src = "client = Anthropic()\nclient.messages.create(model='claude-3-5-sonnet-latest', system='You are a helpful assistant. <very long prompt>', messages=[])\n";
        let hits = run_rule("LLM-CACHE-004", src);
        assert!(!hits.is_empty());
    }
}
