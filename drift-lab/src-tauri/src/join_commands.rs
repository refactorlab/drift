//! Live ↔ static profile join — Tauri command surface.
//!
//! The UI holds the live aggregate (the same `EventLogReport` it
//! already renders into the icicle + table). When the user picks a
//! static scan to join against, the UI sends the live `functions`
//! slice (qualname + file pairs) and the chosen scan id here. This
//! module:
//!
//!   1. Loads the static scan into the flat `Vec<StaticNode>` shape
//!      [`crate::fuzzy_join`] consumes.
//!   2. Converts each `LiveFrameInput` into a `SampledNode`, parsing
//!      the qualname into (bare name, parent_class, qualified_name)
//!      using the same rules as the sampler-side
//!      [`crate::event_log::make_node_id`].
//!   3. Runs `fuzzy_join::suggest_joins` and projects the result into
//!      a UI-friendly [`JoinReport`].
//!
//! The split between this module and `static_scan_index` is on
//! purpose: that module knows nothing about live samples; this module
//! knows nothing about how the static envelope is read off disk. They
//! meet at `Vec<StaticNode>`, which is also the unit-test seam.

use serde::{Deserialize, Serialize};

use crate::fuzzy_join::{suggest_joins, SampledNode, StaticNode};
use crate::path_alias::{infer as infer_alias, PathAlias};
use crate::static_scan_index::load_static_nodes;

/// One sampled qualname/file pair the UI hands us. Matches the
/// `EventLogFunctionStat` subset the join needs — keeping the input
/// flat means the UI can stream just `{qualname, file}` over IPC
/// rather than the whole per-function aggregate.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveFrameInput {
    /// The display name the live aggregator chose for this function.
    /// On Py 3.11+ this is the dotted qualname
    /// (`OrderService.create`); on Py 3.7-3.10 it's the bare name
    /// (`create`). We handle both forms when deriving join keys.
    pub qualname: String,
    /// Absolute path the sampler saw. `None` means the sampler didn't
    /// record one — we still try to join by name alone but score
    /// tiers that require a file path will fail.
    #[serde(default)]
    pub file: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JoinReportMatch {
    pub static_node_id: String,
    pub static_qualified_name: Option<String>,
    pub static_file: String,
    pub confidence: f32,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JoinReportEntry {
    pub sampled_qualname: String,
    pub sampled_file: Option<String>,
    /// `None` when no static candidate cleared the matcher's confidence
    /// threshold. The UI surfaces these as "unjoined" so the user can
    /// debug missing coverage (typically system frames or third-party
    /// libs that aren't in the static scope).
    pub best_match: Option<JoinReportMatch>,
}

/// Auto-detected container→host path mapping. `None` means the
/// matcher fell back to basename-only (Tier-7 of `fuzzy_join`) rather
/// than rewriting paths first.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectedPathAlias {
    pub container_prefix: String,
    pub host_prefix: String,
}

impl From<&PathAlias> for DetectedPathAlias {
    fn from(a: &PathAlias) -> Self {
        Self {
            container_prefix: a.container_prefix.clone(),
            host_prefix: a.host_prefix.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JoinReport {
    pub total_sampled: u32,
    pub joined: u32,
    pub unjoined: u32,
    /// When set, the matcher rewrote every sampled path matching
    /// `container_prefix` to start with `host_prefix` before scoring.
    /// The UI surfaces this so the user knows why coverage is high
    /// (and can spot a wrong alias if one ever sneaks in).
    pub detected_alias: Option<DetectedPathAlias>,
    /// Parallel to the input order. The UI uses this to attach static
    /// metadata to the matching table row / flame frame.
    pub entries: Vec<JoinReportEntry>,
}

/// Tauri command: compute the join for the live functions list against
/// a chosen static scan.
#[tauri::command]
pub async fn compute_join_for_active_scan(
    static_scan_id: String,
    sampled: Vec<LiveFrameInput>,
) -> Result<JoinReport, String> {
    let static_nodes = load_static_nodes(&static_scan_id)?;
    Ok(compute_join(&sampled, &static_nodes))
}

/// Pure orchestration: parse `sampled` qualnames into `SampledNode`s
/// and run the matcher. Split out so unit tests don't need on-disk
/// static envelopes — they can pass synthesized `StaticNode`s straight
/// in.
///
/// **Pre-step: path alias inference.** Before scoring, we try to
/// detect a `container_prefix → host_prefix` mapping from the union
/// of live and static paths (see `path_alias` module). When found,
/// every sampled path that starts with `container_prefix` is
/// rewritten to host form. This pops Docker-vs-host pairings out of
/// the matcher's Tier-7 (basename only, 0.50) and into Tier-2 or
/// Tier-1 (same file or exact id, 0.95+). The detected alias is
/// echoed back to the caller via `JoinReport.detected_alias` so the
/// UI can show "✓ /app/ → my-project/" alongside coverage.
pub(crate) fn compute_join(sampled: &[LiveFrameInput], static_: &[StaticNode]) -> JoinReport {
    // Build the alias-input view. We only feed user-code paths to
    // the inference — there's no `is_system` signal on `LiveFrameInput`
    // (the live aggregate has already classified frames), but
    // `MIN_COVERAGE` guards against stdlib-only matches anyway, and
    // a stdlib frame in the live set won't have a host counterpart
    // (the static scan is scoped to the user's source tree) so it
    // can't vote a winning host prefix.
    let sampled_files_owned: Vec<String> = sampled
        .iter()
        .filter_map(|s| s.file.clone())
        .collect();
    let sampled_files: Vec<&str> = sampled_files_owned.iter().map(|s| s.as_str()).collect();
    let static_files_owned: Vec<&str> = static_.iter().map(|s| s.file.as_str()).collect();
    let alias: Option<PathAlias> = infer_alias(&sampled_files, &static_files_owned);

    // Build SampledNodes with the alias applied (or as-is if no
    // alias was detected). `apply` is a no-op for paths outside the
    // container_prefix, so unconditional application is safe.
    let sampled_nodes: Vec<SampledNode> = sampled
        .iter()
        .map(|s| to_sampled_node(s, alias.as_ref()))
        .collect();
    let suggestions = suggest_joins(&sampled_nodes, static_);
    // Zip with the original `sampled` slice so the UI gets back the
    // exact qualname it sent — matching it to the right table row
    // without having to re-derive class info from the node_id.
    let entries: Vec<JoinReportEntry> = suggestions
        .into_iter()
        .zip(sampled.iter())
        .map(|(sug, input)| JoinReportEntry {
            sampled_qualname: input.qualname.clone(),
            sampled_file: input.file.clone(),
            best_match: sug.best_match.map(|m| JoinReportMatch {
                static_node_id: m.static_node_id,
                static_qualified_name: m.static_qualified_name,
                static_file: m.static_file,
                confidence: m.confidence,
                reason: m.reason,
            }),
        })
        .collect();
    let joined = entries.iter().filter(|e| e.best_match.is_some()).count() as u32;
    let total_sampled = entries.len() as u32;
    JoinReport {
        total_sampled,
        joined,
        unjoined: total_sampled - joined,
        detected_alias: alias.as_ref().map(DetectedPathAlias::from),
        entries,
    }
}

/// Convert a live qualname/file pair into the `SampledNode` shape
/// [`crate::fuzzy_join`] expects.
///
/// When `alias` is provided and the input's file matches the
/// container prefix, the file is rewritten to host form first. That
/// makes the resulting `node_id` line up with the static side's id
/// — the matcher then fires at Tier 1 / Tier 2 instead of Tier 7.
///
/// The two non-alias decisions:
///   - `name` is the **bare** name (everything after the final `.`).
///     The matcher's basename + name tiers compare bare names; without
///     splitting, `OrderService.create` would never match a static
///     `create` symbol.
///   - `parent_class` is the prefix before the final `.`, with the
///     CPython closure marker `<locals>` treated as "no class" (a
///     closure scope is not a class — matches `make_node_id`'s rule).
fn to_sampled_node(input: &LiveFrameInput, alias: Option<&PathAlias>) -> SampledNode {
    let raw = input.file.clone().unwrap_or_default();
    let file = match alias {
        Some(a) => a.apply(&raw),
        None => raw,
    };
    let (parent_class, bare_name, qualified_name) = parse_qualname(&input.qualname);
    let node_id = match (&parent_class, &qualified_name) {
        (Some(cls), _) => format!("{file}::{cls}::{bare_name}"),
        _ => format!("{file}::{bare_name}"),
    };
    SampledNode {
        node_id,
        name: bare_name,
        file,
        qualified_name,
        parent_class,
    }
}

/// Split `qualname` into `(parent_class, bare_name, qualified_name)`.
/// Mirrors the rules in [`crate::event_log::make_node_id`] so the
/// join keys we produce on this side line up with the ones the live
/// aggregator stamps on tree nodes.
fn parse_qualname(qualname: &str) -> (Option<String>, String, Option<String>) {
    if qualname.is_empty() {
        return (None, String::new(), None);
    }
    // CPython encodes closure scopes as `outer.<locals>.inner`; treat
    // those as free functions (no class) and drop the qualified_name
    // signal — same call the live make_node_id makes.
    if qualname.contains("<locals>") {
        let bare = qualname.rsplit('.').next().unwrap_or(qualname).to_string();
        return (None, bare, None);
    }
    match qualname.rfind('.') {
        Some(idx) => {
            let cls = &qualname[..idx];
            let bare = &qualname[idx + 1..];
            if cls.is_empty() || bare.is_empty() {
                (None, qualname.to_string(), None)
            } else {
                (
                    Some(cls.to_string()),
                    bare.to_string(),
                    Some(qualname.to_string()),
                )
            }
        }
        None => (None, qualname.to_string(), None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fuzzy_join::StaticNode;

    fn s_node(name: &str, file: &str, parent_class: Option<&str>) -> StaticNode {
        let qn = parent_class.map(|c| format!("{c}.{name}"));
        let nid = match parent_class {
            Some(c) => format!("{file}::{c}::{name}"),
            None => format!("{file}::{name}"),
        };
        StaticNode {
            node_id: nid,
            name: name.into(),
            file: file.into(),
            qualified_name: qn,
            parent_class: parent_class.map(String::from),
        }
    }

    fn live(qualname: &str, file: Option<&str>) -> LiveFrameInput {
        LiveFrameInput {
            qualname: qualname.into(),
            file: file.map(String::from),
        }
    }

    // -------- parse_qualname behavior --------

    #[test]
    fn parse_dotted_qualname_extracts_class_and_bare() {
        let (cls, bare, qn) = parse_qualname("OrderService.create");
        assert_eq!(cls.as_deref(), Some("OrderService"));
        assert_eq!(bare, "create");
        assert_eq!(qn.as_deref(), Some("OrderService.create"));
    }

    #[test]
    fn parse_bare_qualname_has_no_class() {
        let (cls, bare, qn) = parse_qualname("create_order");
        assert_eq!(cls, None);
        assert_eq!(bare, "create_order");
        assert_eq!(qn, None);
    }

    #[test]
    fn parse_closure_qualname_drops_class_signal() {
        // Closure: outer.<locals>.inner — these aren't class methods.
        let (cls, bare, qn) = parse_qualname("outer.<locals>.inner");
        assert_eq!(cls, None);
        assert_eq!(bare, "inner");
        assert_eq!(qn, None);
    }

    #[test]
    fn parse_empty_qualname_returns_empty() {
        let (cls, bare, qn) = parse_qualname("");
        assert_eq!(cls, None);
        assert_eq!(bare, "");
        assert_eq!(qn, None);
    }

    // -------- compute_join behavior --------

    #[test]
    fn join_empty_inputs_yields_zero_counts() {
        let report = compute_join(&[], &[]);
        assert_eq!(report.total_sampled, 0);
        assert_eq!(report.joined, 0);
        assert_eq!(report.unjoined, 0);
        assert!(report.entries.is_empty());
    }

    #[test]
    fn join_unmatched_sampled_lands_in_unjoined_bucket() {
        let sampled = vec![live("asyncio.run", Some("/usr/lib/python3.7/asyncio/runners.py"))];
        let static_ = vec![s_node("create", "/Users/me/proj/orders.py", Some("OrderService"))];
        let report = compute_join(&sampled, &static_);
        assert_eq!(report.total_sampled, 1);
        assert_eq!(report.joined, 0);
        assert_eq!(report.unjoined, 1);
        assert!(report.entries[0].best_match.is_none());
    }

    #[test]
    fn join_docker_path_to_host_static_matches_via_alias() {
        // Real-world case: live frame in a container, static scan
        // on the host. With Phase-2 path-alias inference the `/app/`
        // prefix is detected, the live path is rewritten to the
        // host form, and the match climbs to Tier 5 (same file +
        // same name, 0.7) — class info on the live side is missing
        // (Py 3.7 fixture) so it can't reach higher tiers.
        let sampled = vec![live("create", Some("/app/orders.py"))];
        let static_ = vec![s_node(
            "create",
            "/Users/me/test-python-web-server/orders.py",
            Some("OrderService"),
        )];
        let report = compute_join(&sampled, &static_);
        assert_eq!(report.joined, 1);
        assert!(report.detected_alias.is_some(), "alias must be detected");
        let m = report.entries[0].best_match.as_ref().unwrap();
        // Same-file + same-name → Tier 5 (0.7). Without the alias
        // this would have been Tier 7 (0.5).
        assert!((m.confidence - 0.7).abs() < 1e-6, "got {}", m.confidence);
        assert_eq!(m.reason, "same file + same name");
        assert_eq!(m.static_file, "/Users/me/test-python-web-server/orders.py");
    }

    #[test]
    fn join_dotted_qualname_with_alias_climbs_to_tier_1() {
        // Py 3.11+ sample carries `OrderService.create` AND alias
        // detection lines the file up byte-for-byte. Both signals
        // align so we hit Tier 1 (exact node_id match, 1.0).
        let sampled = vec![live("OrderService.create", Some("/app/orders.py"))];
        let static_ = vec![s_node(
            "create",
            "/Users/me/test-python-web-server/orders.py",
            Some("OrderService"),
        )];
        let report = compute_join(&sampled, &static_);
        assert_eq!(report.joined, 1);
        assert!(report.detected_alias.is_some());
        let m = report.entries[0].best_match.as_ref().unwrap();
        assert!((m.confidence - 1.0).abs() < 1e-6, "got {}", m.confidence);
        assert_eq!(m.reason, "exact node_id match");
    }

    #[test]
    fn join_entries_are_parallel_to_input_order() {
        let sampled = vec![
            live("create", Some("/app/orders.py")),
            live("asyncio.run", Some("/usr/lib/python3.7/asyncio/runners.py")),
            live("create_order", Some("/app/app.py")),
        ];
        let static_ = vec![
            s_node("create", "/host/proj/orders.py", Some("OrderService")),
            s_node("create_order", "/host/proj/app.py", None),
        ];
        let report = compute_join(&sampled, &static_);
        assert_eq!(report.total_sampled, 3);
        assert_eq!(report.joined, 2);
        assert_eq!(report.unjoined, 1);
        // Order preserved: index 0 matched, 1 unmatched, 2 matched.
        assert!(report.entries[0].best_match.is_some());
        assert!(report.entries[1].best_match.is_none());
        assert!(report.entries[2].best_match.is_some());
    }

    #[test]
    fn join_preserves_original_sampled_qualname() {
        // The UI joins each report entry back to its table row by
        // qualname. If we returned the bare-name parse we'd lose
        // `OrderService.create` → `create` and the row wouldn't
        // find its static metadata. Pin this end-to-end.
        let sampled = vec![
            live("OrderService.create", Some("/app/orders.py")),
            live("create_order", Some("/app/app.py")),
        ];
        let static_ = vec![
            s_node("create", "/host/orders.py", Some("OrderService")),
            s_node("create_order", "/host/app.py", None),
        ];
        let report = compute_join(&sampled, &static_);
        assert_eq!(report.entries[0].sampled_qualname, "OrderService.create");
        assert_eq!(report.entries[1].sampled_qualname, "create_order");
        // sampled_file must also round-trip — the UI shows it in the
        // "unmatched" debug list so the user can see the live path.
        assert_eq!(
            report.entries[0].sampled_file.as_deref(),
            Some("/app/orders.py"),
        );
    }

    #[test]
    fn join_carries_static_file_and_node_id_to_ui() {
        let sampled = vec![live("create", Some("/app/orders.py"))];
        let static_ = vec![s_node(
            "create",
            "/host/proj/orders.py",
            Some("OrderService"),
        )];
        let report = compute_join(&sampled, &static_);
        let m = report.entries[0].best_match.as_ref().unwrap();
        assert_eq!(m.static_node_id, "/host/proj/orders.py::OrderService::create");
        assert_eq!(m.static_file, "/host/proj/orders.py");
        assert_eq!(m.static_qualified_name.as_deref(), Some("OrderService.create"));
    }

    // ---- the realistic test-python-web-server scenario --------------------
    //
    // Mirrors the exact data from the user's real run:
    //   - live: /app/orders.py + name=create, /app/app.py + name=create_order
    //   - static: full host paths + parent_class for the OrderService methods
    // No sampled qualified_name (Py 3.7 in the container) — Tier 7 territory.

    // -------- path-alias integration (Phase 2) --------

    #[test]
    fn join_detects_docker_alias_and_lifts_confidence_to_tier_1() {
        // With auto-detection, both live frames pop from Tier 7
        // (basename + name, 0.50) to Tier 1 (exact node_id, 1.0)
        // because the rewritten paths match the static paths
        // byte-for-byte AND the class info aligns.
        //
        // Pre-condition for Tier 1: same node_id. The static side
        // builds `<file>::<class>::<name>` for class methods; we
        // need the LIVE side to also carry the class. The live
        // sampler does on Py 3.11+ — supply qualname accordingly.
        let host = "/Users/me/test-python-web-server";
        let sampled = vec![
            live("OrderService.create", Some("/app/orders.py")),
            live("OrderService.ship", Some("/app/orders.py")),
        ];
        let static_ = vec![
            s_node("create", &format!("{host}/orders.py"), Some("OrderService")),
            s_node("ship", &format!("{host}/orders.py"), Some("OrderService")),
            // Need at least two static paths to give the alias
            // inference something to match against.
            s_node("create_order", &format!("{host}/app.py"), None),
        ];
        let report = compute_join(&sampled, &static_);
        let alias = report.detected_alias.as_ref().expect("must detect alias");
        assert_eq!(alias.container_prefix, "/app/");
        assert_eq!(alias.host_prefix, format!("{host}/"));
        // Both join at Tier 1 now.
        for entry in &report.entries {
            let m = entry.best_match.as_ref().unwrap();
            assert!(
                (m.confidence - 1.0).abs() < 1e-6,
                "confidence={} reason={}",
                m.confidence,
                m.reason,
            );
            assert_eq!(m.reason, "exact node_id match");
        }
    }

    #[test]
    fn join_py37_with_alias_still_lifts_to_tier_2() {
        // Py 3.7 sampler has no qualname → no class on the live
        // side. With alias the file matches the static side
        // byte-for-byte; Tier 2 (same file + same name, technically
        // Tier 5 since no qn) at 0.7 — better than Tier 7's 0.5.
        let host = "/Users/me/svc";
        let sampled = vec![
            live("create", Some("/app/orders.py")),
            live("create_order", Some("/app/app.py")),
        ];
        let static_ = vec![
            s_node("create", &format!("{host}/orders.py"), Some("OrderService")),
            s_node("create_order", &format!("{host}/app.py"), None),
        ];
        let report = compute_join(&sampled, &static_);
        assert!(report.detected_alias.is_some());
        // create_order is a free function — same-file same-name
        // hits Tier 5 (0.7). create is a method on OrderService;
        // we have class on the static side but not the live side,
        // so Tier 5 (same file + same name) is the best we get
        // without a live qualname.
        for entry in &report.entries {
            let m = entry.best_match.as_ref().unwrap();
            assert!(
                m.confidence >= 0.7,
                "alias should lift to Tier 5+, got {} ({})",
                m.confidence,
                m.reason,
            );
        }
    }

    #[test]
    fn join_returns_no_alias_when_paths_dont_match_any_candidate() {
        // Live paths are under /tmp/ — not in the candidate prefix
        // list. No alias detected, fall back to basename matching.
        let sampled = vec![live("create", Some("/tmp/foo/orders.py"))];
        let static_ = vec![s_node("create", "/host/proj/orders.py", Some("OrderService"))];
        let report = compute_join(&sampled, &static_);
        assert!(report.detected_alias.is_none());
        // Still joins via basename — Tier 7.
        let m = report.entries[0].best_match.as_ref().unwrap();
        assert!((m.confidence - 0.5).abs() < 1e-6);
    }

    #[test]
    fn alias_only_rewrites_matching_paths_not_stdlib() {
        // The live set carries a stdlib frame AND a user frame.
        // The alias should rewrite the /app/ one; the asyncio
        // frame must come back unmatched (no static counterpart).
        let host = "/Users/me/svc";
        let sampled = vec![
            live("create_order", Some("/app/app.py")),
            live("run", Some("/usr/lib/python3.7/asyncio/runners.py")),
        ];
        let static_ = vec![
            s_node("create_order", &format!("{host}/app.py"), None),
            // Second static path so the alias inference has enough
            // to vote on.
            s_node("ship_order", &format!("{host}/app.py"), None),
        ];
        let report = compute_join(&sampled, &static_);
        assert!(report.detected_alias.is_some());
        assert!(report.entries[0].best_match.is_some(), "user frame joins");
        assert!(report.entries[1].best_match.is_none(), "stdlib stays unjoined");
        // The stdlib path must come back as it went in — no
        // accidental rewriting just because /usr/lib/... overlaps
        // none of the candidate prefixes.
        assert_eq!(
            report.entries[1].sampled_file.as_deref(),
            Some("/usr/lib/python3.7/asyncio/runners.py"),
        );
    }

    #[test]
    fn join_test_python_web_server_real_scenario() {
        let host = "/Users/me/test-python-web-server";
        let sampled = vec![
            live("create", Some("/app/orders.py")),
            live("create_order", Some("/app/app.py")),
            live("<module>", Some("/usr/local/bin/uvicorn")),  // unjoinable
        ];
        let static_ = vec![
            s_node("create", &format!("{host}/orders.py"), Some("OrderService")),
            s_node("charge", &format!("{host}/orders.py"), Some("OrderService")),
            s_node("ship",   &format!("{host}/orders.py"), Some("OrderService")),
            s_node("create_order", &format!("{host}/app.py"), None),
            s_node("charge_order", &format!("{host}/app.py"), None),
            s_node("ship_order",   &format!("{host}/app.py"), None),
        ];
        let report = compute_join(&sampled, &static_);
        assert_eq!(report.total_sampled, 3);
        // Both user-code frames join via basename match; the uvicorn
        // entry has no static counterpart and stays unjoined.
        assert_eq!(report.joined, 2);
        assert_eq!(report.unjoined, 1);
        let m_create = report.entries[0].best_match.as_ref().unwrap();
        assert_eq!(m_create.static_file, format!("{host}/orders.py"));
        let m_co = report.entries[1].best_match.as_ref().unwrap();
        assert_eq!(m_co.static_file, format!("{host}/app.py"));
        assert!(report.entries[2].best_match.is_none());
    }
}
