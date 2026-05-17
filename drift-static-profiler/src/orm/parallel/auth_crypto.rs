//! Auth / crypto perf antipatterns — where security choices have major
//! runtime cost.
//!
//! Phase 1 of the parallel auth/crypto track:
//! - `AC-BCRYPT-001` — `bcrypt.hashpw(...)` / `passlib.context.verify(...)`
//!   inside a loop (or a non-bg-queue request handler).
//! - `AC-RSA-002` — `rsa.generate_private_key(...)` inside a loop or
//!   handler (multi-second op).
//! - `AC-JWKS-003` — `requests.get(<jwks_uri>)` / `urlopen(...)` of a
//!   `.well-known/jwks.json` style URL inside a non-cache wrapper.

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

fn last_method(chain: &CallChain) -> &str {
    chain.steps.last().map(|s| s.method.as_str()).unwrap_or("")
}

fn root_text(chain: &CallChain) -> String {
    match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => String::new(),
    }
}

// ─── AC-BCRYPT-001: bcrypt in loop ──────────────────────────────────────

fn matches_ac_bcrypt_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = last_method(chain);
        let r = root_text(chain);
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        let is_bcrypt = (r == "bcrypt" && matches!(last, "hashpw" | "checkpw" | "kdf"))
            || (methods.contains(&"hash")
                && (r == "context" || r == "pwd_context" || methods.contains(&"context")));
        if is_bcrypt {
            out.push(hit(chain, "AC-BCRYPT-001"));
        }
    }
    out
}

// ─── AC-RSA-002: RSA keygen in loop / handler ───────────────────────────

fn matches_ac_rsa_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let last = last_method(chain);
        if !matches!(last, "generate_private_key" | "generate") {
            continue;
        }
        // Confidence-tuning: fire only when in_loop OR when imports
        // include `cryptography.hazmat.primitives.asymmetric.rsa` /
        // `Crypto.PublicKey.RSA`.
        let crypto_imported = ctx
            .imports
            .modules
            .keys()
            .any(|m| m.contains("rsa") || m.contains("RSA"))
            || ctx
                .imports
                .modules
                .values()
                .flatten()
                .any(|v| v == "rsa" || v == "RSA");
        if chain.in_loop || crypto_imported {
            out.push(hit(chain, "AC-RSA-002"));
        }
    }
    out
}

// ─── AC-JWKS-003: JWKS fetch per request ────────────────────────────────

fn matches_ac_jwks_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        for step in &chain.steps {
            if !matches!(step.method.as_str(), "get" | "urlopen" | "fetch_jwks") {
                continue;
            }
            for arg in &step.args_text {
                let lower = arg.to_lowercase();
                if lower.contains("jwks") || lower.contains(".well-known") {
                    out.push(hit(chain, "AC-JWKS-003"));
                    break;
                }
            }
        }
    }
    out
}

pub const AUTH_CRYPTO_RULES: &[OrmRule] = &[
    OrmRule {
        id: "AC-BCRYPT-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Medium,
        message: "`bcrypt.hashpw` / `pwd_context.hash` inside a loop — bcrypt cost is hundreds of ms per call.",
        remediation: "Move bcrypt to an async/background queue; never call it in a tight loop on a request thread.",
        confidence: 0.90,
        matches: matches_ac_bcrypt_001,
    },
    OrmRule {
        id: "AC-RSA-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Medium,
        message: "RSA private-key generation in a hot path — multi-second op blocks the request.",
        remediation: "Generate keys at startup or via offline rotation; cache loaded keys in memory.",
        confidence: 0.85,
        matches: matches_ac_rsa_002,
    },
    OrmRule {
        id: "AC-JWKS-003",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "JWKS endpoint fetched per request — adds a network round-trip to every auth call.",
        remediation: "Cache JWKS keys with TTL (e.g. `cachetools.TTLCache`) or use a JWT lib with built-in JWKS caching.",
        confidence: 0.85,
        matches: matches_ac_jwks_003,
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
        let rule = AUTH_CRYPTO_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn ac_bcrypt_001_fires_in_loop() {
        let src = "import bcrypt\nfor pw in passwords:\n    bcrypt.hashpw(pw.encode(), bcrypt.gensalt())\n";
        let hits = run_rule("AC-BCRYPT-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn ac_jwks_003_fires_on_well_known() {
        let src = "import requests\nrequests.get('https://auth.example.com/.well-known/jwks.json')\n";
        let hits = run_rule("AC-JWKS-003", src);
        assert!(!hits.is_empty());
    }
}
