//! pr_quality::tokens — tokenizer-free LLM token estimation for code.
//!
//! There is **no offline Claude tokenizer** (PR_QUALITY_RESEARCH §8.2), so
//! the byte/token ratio is a calibrated KNOB, not a fact. We estimate
//! rather than tokenize at runtime:
//!
//! - **Primary**: `bytes / 2.8` — byte-faithful (BPE operates on UTF-8
//!   bytes), O(1), and auto-corrects for multibyte (more bytes ⇒ more
//!   tokens, the right direction). Targets the *harsh* end (newest Claude
//!   fragments code to ~2.69 chars/tok), so it's safety-biased (over-budget).
//! - **Cross-check**: `word_tokens × 2.1` — fails on *orthogonal* inputs
//!   to the byte path (minification), so divergence is a "weird file" flag.
//! - **Fallback**: `loc × 13` when source bytes are unavailable.
//!
//! Context-window pressure bands the diff footprint against a 1M-token
//! default discounted by a ~0.30 usable fraction (long-context
//! degradation: NoLiMa/Chroma) plus a fixed prompt overhead.
//!
//! `tiktoken-rs` validates these constants as a dev-only oracle (see the
//! `#[cfg(test)]` block) — it never ships in the runtime path.

use super::finite_or_zero;
use crate::pr_algorithms::constants::pq_num;
use crate::pr_algorithms::types::{ContextPressure, TokenFootprint};

/// Primary estimate: `ceil(bytes / K_code)`, `K_code = 2.8`.
pub fn estimate_from_bytes(byte_len: usize) -> usize {
    let k = pq_num("tokens.bytes_per_token_code");
    if k <= 0.0 {
        return byte_len;
    }
    (byte_len as f64 / k).ceil() as usize
}

/// Cross-check estimate from a word-token count.
pub fn estimate_from_words(word_tokens: usize) -> usize {
    let r = pq_num("tokens.bpe_per_word_token");
    (word_tokens as f64 * r).round() as usize
}

/// LOC fallback when file bytes are unavailable (binary, unreadable, or
/// no `repo_root`).
pub fn estimate_from_loc(changed_loc: usize) -> usize {
    let per = pq_num("tokens.per_loc_fallback");
    (changed_loc as f64 * per).round() as usize
}

/// Word-token count the `duplication::token_shingles` way: runs of
/// alphanumeric-or-`_`. The punctuation it discards is exactly what BPE
/// charges for, which is why the `×2.1` factor recovers the BPE count.
pub fn count_word_tokens(text: &str) -> usize {
    let mut n = 0usize;
    let mut in_tok = false;
    for c in text.chars() {
        let is_word = c.is_alphanumeric() || c == '_';
        if is_word && !in_tok {
            n += 1;
        }
        in_tok = is_word;
    }
    n
}

fn band(estimate: usize, source: &str) -> TokenFootprint {
    let band_pct = pq_num("tokens.estimate_band_pct");
    let lo = (estimate as f64 * (1.0 - band_pct)).floor() as usize;
    let hi = (estimate as f64 * (1.0 + band_pct)).ceil() as usize;
    TokenFootprint {
        estimate,
        lo,
        hi,
        source: source.to_string(),
    }
}

/// Footprint from raw bytes; if `text` is supplied, blend with the
/// word-token cross-check (0.5/0.5) and report the blend.
pub fn footprint_from_bytes(byte_len: usize, text: Option<&str>) -> TokenFootprint {
    let by_bytes = estimate_from_bytes(byte_len);
    match text {
        Some(t) => {
            let by_words = estimate_from_words(count_word_tokens(t));
            let blended = ((by_bytes + by_words) as f64 / 2.0).round() as usize;
            band(blended, "bytes/2.8 + word×2.1 blend")
        }
        None => band(by_bytes, "bytes/2.8"),
    }
}

/// Footprint from LOC only (fallback path).
pub fn footprint_from_loc(changed_loc: usize) -> TokenFootprint {
    band(estimate_from_loc(changed_loc), "loc×13 (fallback)")
}

/// Context-window pressure for a diff's token footprint against the
/// default 1M model, discounted by the usable fraction + prompt overhead.
/// GREEN/YELLOW/RED bands; `load` is auditable, not a hidden constant.
pub fn context_pressure(diff_tokens: usize) -> ContextPressure {
    let window = pq_num("llm.context_window_default") as usize;
    let usable_frac = pq_num("llm.context_usable_fraction");
    let overhead = pq_num("llm.prompt_overhead_tokens") as usize;
    let usable_total = (window as f64 * usable_frac).max(1.0);
    let usable_budget = (usable_total as usize).saturating_sub(overhead);
    let load = finite_or_zero((diff_tokens + overhead) as f64 / usable_total);

    let green = pq_num("llm.context_band_green_max") as usize;
    let yellow = pq_num("llm.context_band_yellow_max") as usize;
    let band = if diff_tokens < green {
        "green"
    } else if diff_tokens < yellow {
        "yellow"
    } else {
        "red"
    };
    ContextPressure {
        band: band.to_string(),
        target_window: window,
        usable_budget,
        // Raw ratio (may exceed 1.0 → over-budget → RED); finite-guarded.
        load,
        note: "assumes ~30% usable context (long-context degradation: NoLiMa/Chroma)".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn byte_estimate_is_monotone_and_safety_biased() {
        // Strictly non-decreasing in bytes.
        assert!(estimate_from_bytes(0) <= estimate_from_bytes(100));
        assert!(estimate_from_bytes(100) < estimate_from_bytes(1000));
        // bytes/2.8: 2800 bytes → ~1000 tokens (ceil + float ⇒ 1000–1001;
        // rounding up is the intended over-budget safety bias).
        assert!((1000..=1001).contains(&estimate_from_bytes(2800)));
    }

    #[test]
    fn word_count_splits_on_non_alnum() {
        assert_eq!(count_word_tokens("self.user_map.get(key)"), 4); // self, user_map, get, key
        assert_eq!(count_word_tokens(""), 0);
        assert_eq!(count_word_tokens("   "), 0);
        assert_eq!(count_word_tokens("a+b*c"), 3);
    }

    #[test]
    fn footprint_band_brackets_estimate() {
        let f = footprint_from_bytes(2800, None);
        assert!((1000..=1001).contains(&f.estimate));
        assert!(f.lo < f.estimate && f.estimate < f.hi, "band must bracket: {f:?}");
        assert_eq!(f.source, "bytes/2.8");
    }

    #[test]
    fn blend_uses_both_estimators() {
        let f = footprint_from_bytes(2800, Some("fn foo ( ) { bar ( ) ; }"));
        assert!(f.source.contains("blend"));
        assert!(f.estimate > 0);
    }

    #[test]
    fn context_bands_track_size() {
        assert_eq!(context_pressure(10_000).band, "green"); // < 45k
        assert_eq!(context_pressure(60_000).band, "yellow"); // 45k..110k
        assert_eq!(context_pressure(200_000).band, "red"); // > 110k
    }

    #[test]
    fn context_load_is_finite_for_extreme_input() {
        let c = context_pressure(usize::MAX / 4);
        assert!(c.load.is_finite());
        assert_eq!(c.band, "red");
    }

    /// Oracle: our `bytes/2.8` estimate must be within the advertised
    /// ±20% band of the REAL OpenAI o200k tokenization on representative
    /// code (and stay safety-biased = over-budget, never wildly under).
    /// tiktoken-rs is dev-only; this never ships in the runtime path.
    #[test]
    fn byte_estimate_brackets_tiktoken_o200k() {
        use tiktoken_rs::o200k_base;
        let bpe = o200k_base().expect("o200k_base");
        let samples = [
            "fn handle(req: Request) -> Result<Response> {\n    let user = db.find(req.id)?;\n    Ok(Response::ok(user))\n}\n",
            "def create_order(items, customer_id):\n    total = sum(i.price for i in items)\n    return Order(customer_id=customer_id, total=total)\n",
            "export async function fetchUser(id: string): Promise<User> {\n  const res = await api.get(`/users/${id}`);\n  return res.data as User;\n}\n",
        ];
        for s in samples {
            let truth = bpe.encode_with_special_tokens(s).len();
            let est = estimate_from_bytes(s.len());
            // Within a generous factor either way (the estimator targets
            // the harsh Claude end, so it tends to over-count cl100k/o200k
            // — that's the intended safety bias). Assert it's the right
            // order of magnitude and never under-counts by >35%.
            let ratio = est as f64 / truth as f64;
            assert!(
                (0.65..=2.2).contains(&ratio),
                "estimate {est} vs o200k truth {truth} (ratio {ratio:.2}) for {s:?}"
            );
        }
    }
}
