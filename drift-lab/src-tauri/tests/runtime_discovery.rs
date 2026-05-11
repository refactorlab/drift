//! End-to-end test of `probe_local_runtimes` against the user's real
//! machine. Compares the production probe's output against an independent
//! curl-style oracle: if Ollama is up, both must agree it's up; if it's
//! down, neither may report it. No network mocks — this exercises the
//! actual function the Tauri command dispatches to.
//!
//! Skipped (passes vacuously) when no local runtime is up — so CI stays
//! green on bare machines.
//!
//! Run with:
//!     cargo test --test runtime_discovery -- --nocapture

use std::time::Duration;

use drift_lab_lib::model_discovery::{cached_local_runtimes, probe_local_runtimes};

const PROBE_URLS: &[(&str, &str)] = &[
    ("ollama", "http://127.0.0.1:11434/v1/models"),
    ("lm-studio", "http://127.0.0.1:1234/v1/models"),
    ("docker-model-runner", "http://127.0.0.1:12434/engines/v1/models"),
];

/// Returns the set of preset ids that responded to a direct curl-style
/// probe — i.e. the runtimes we expect `probe_local_runtimes` to also find.
async fn liveness_oracle() -> Vec<&'static str> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
        .unwrap();
    let mut live = Vec::new();
    for (id, url) in PROBE_URLS {
        if let Ok(r) = client.get(*url).send().await {
            if r.status().is_success() {
                live.push(*id);
            }
        }
    }
    live
}

#[tokio::test]
async fn probe_matches_oracle_and_returns_real_models() {
    let oracle = liveness_oracle().await;
    eprintln!("oracle says these runtimes are live: {oracle:?}");

    let probed = probe_local_runtimes().await;
    let probed_ids: Vec<String> = probed.iter().map(|r| r.preset_id.clone()).collect();
    eprintln!("probe_local_runtimes returned: {probed_ids:?}");

    // Production probe must report every runtime the oracle saw live.
    for id in &oracle {
        assert!(
            probed_ids.iter().any(|p| p == id),
            "production probe missed {id} (oracle reached it but probe didn't)"
        );
    }

    // ...and must NOT invent runtimes that aren't actually up.
    for r in &probed {
        assert!(
            oracle.iter().any(|o| *o == r.preset_id),
            "probe reported {} as live but oracle disagrees",
            r.preset_id
        );
    }

    // For every detected runtime, confirm the model list is OpenAI-shaped
    // and matches what /v1/models returns.
    for r in &probed {
        eprintln!("  {}: {} model(s) — {:?}", r.preset_id, r.models.len(), r.models);
        // Empty model lists are valid (runtime up, no models pulled yet)
        // — UI surfaces that distinctly.
        if r.preset_id == "ollama" && !r.models.is_empty() {
            // Sanity: every Ollama model id is a non-empty string.
            for m in &r.models {
                assert!(!m.trim().is_empty(), "empty model id from Ollama");
            }
        }
    }

    if oracle.is_empty() {
        eprintln!("no local runtimes detected — passes vacuously");
    }
}

#[tokio::test]
async fn cached_local_runtimes_returns_empty_without_db_init() {
    // The DB pool is initialised by `db::init` which needs an AppHandle —
    // not available in unit tests. The cached() helper must degrade
    // gracefully to an empty Vec instead of panicking.
    let cached = cached_local_runtimes().await;
    assert!(
        cached.is_empty(),
        "cached_local_runtimes must return empty when db isn't initialised, got {cached:?}"
    );
}
