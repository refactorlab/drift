//! §3.10 — Function-name duplication detection (≥95% similarity) via `strsim`.
//!
//! Uses `strsim::normalized_levenshtein` which returns 0..1 with 1 =
//! identical. We convert to a 0..100 ratio and clamp at the
//! user-specified 95 threshold. Replaces Python rapidfuzz.

use crate::pr_algorithms::constants::{
    duplication_max_compare_candidates, duplication_ratio_threshold,
};
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use std::collections::{HashMap, HashSet};

// Cap on the candidate symbol list — now sourced from
// `schema/pr_algorithms_constants.json::thresholds.duplication_max_compare_candidates`.
// See `constants::duplication_max_compare_candidates()`.

const EXCLUDE_PREFIX: &[&str] = &["_", "test_", "should_", "it_", "describe_"];
const GENERIC_NAMES: &[&str] = &[
    "__init__", "main", "run", "build", "new", "default", "init", "setup", "teardown",
    "execute", "handle", "process",
];

fn should_compare(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    if GENERIC_NAMES.iter().any(|g| *g == name) {
        return false;
    }
    if EXCLUDE_PREFIX.iter().any(|p| name.starts_with(p)) {
        return false;
    }
    name.len() >= 4
}

fn walk_symbols(entries: &[CallTreeNode]) -> Vec<(String, String)> {
    let mut seen: HashSet<(String, String)> = HashSet::new();
    let mut out: Vec<(String, String)> = Vec::new();
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(node) = stack.pop() {
        let key = (node.name.clone(), node.file.clone());
        if !node.name.is_empty() && seen.insert(key.clone()) {
            out.push(key);
        }
        for c in &node.children {
            stack.push(c);
        }
    }
    out
}

struct UnionFind {
    parent: Vec<usize>,
}

impl UnionFind {
    fn new(n: usize) -> Self {
        Self {
            parent: (0..n).collect(),
        }
    }
    fn find(&mut self, mut i: usize) -> usize {
        while self.parent[i] != i {
            self.parent[i] = self.parent[self.parent[i]];
            i = self.parent[i];
        }
        i
    }
    fn union(&mut self, i: usize, j: usize) {
        let ri = self.find(i);
        let rj = self.find(j);
        if ri != rj {
            self.parent[ri] = rj;
        }
    }
}

// Per-thread DP buffers reused across pair comparisons. Eliminates
// the per-pair Vec allocation that dominated the cost on huge
// candidate sets.
thread_local! {
    static DP_PREV: std::cell::RefCell<Vec<usize>> = std::cell::RefCell::new(Vec::with_capacity(256));
    static DP_CURR: std::cell::RefCell<Vec<usize>> = std::cell::RefCell::new(Vec::with_capacity(256));
}

/// Bounded Levenshtein with early-exit. Standard 2-row DP, but on
/// each completed row we check whether the row's minimum cell has
/// already exceeded `max_dist` — if so, no path to the bottom-right
/// corner can ever produce a distance ≤ max_dist, so we return
/// `max_dist + 1` and skip the rest of the matrix.
///
/// For a 95% threshold the allowed `max_dist` is tiny (typically 0–2
/// edits on identifier-length strings), so this prunes the vast
/// majority of pairwise comparisons cheaply.
fn levenshtein_bounded(a_chars: &[char], b_chars: &[char], max_dist: usize) -> usize {
    let la = a_chars.len();
    let lb = b_chars.len();
    if la.abs_diff(lb) > max_dist {
        return max_dist + 1;
    }
    if la == 0 {
        return lb;
    }
    if lb == 0 {
        return la;
    }

    DP_PREV.with(|prev_cell| {
        DP_CURR.with(|curr_cell| {
            let mut prev = prev_cell.borrow_mut();
            let mut curr = curr_cell.borrow_mut();
            prev.clear();
            prev.extend(0..=lb);
            curr.clear();
            curr.resize(lb + 1, 0);

            for i in 1..=la {
                curr[0] = i;
                let mut row_min = i;
                for j in 1..=lb {
                    let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
                    let val = (curr[j - 1] + 1)
                        .min(prev[j] + 1)
                        .min(prev[j - 1] + cost);
                    curr[j] = val;
                    if val < row_min {
                        row_min = val;
                    }
                }
                if row_min > max_dist {
                    return max_dist + 1;
                }
                std::mem::swap(&mut *prev, &mut *curr);
            }
            prev[lb]
        })
    })
}

/// rapidfuzz-compatible `fuzz.ratio`. Uses `(len_a + len_b -
/// distance) / (len_a + len_b)` instead of strsim's default
/// `1 - distance/max(len)`. `threshold` is the ratio (0..100) we
/// care about; we derive the max allowable edit distance from it
/// and short-circuit early via [`levenshtein_bounded`].
fn ratio_with_threshold(
    a_chars: &[char],
    b_chars: &[char],
    threshold: u8,
) -> u8 {
    let la = a_chars.len();
    let lb = b_chars.len();
    let sum = la + lb;
    if sum == 0 {
        return 100;
    }
    // ratio ≥ threshold ↔ dist ≤ (100 - threshold) × sum / 100.
    // Use ceiling so threshold-boundary cases (e.g. 96%) don't
    // get rejected by integer floor.
    let max_dist =
        ((100usize.saturating_sub(threshold as usize)) * sum + 99) / 100;
    let dist = levenshtein_bounded(a_chars, b_chars, max_dist);
    if dist > sum {
        // Bound exceeded; can't reach threshold.
        return 0;
    }
    let sim = (sum - dist) as f64 / sum as f64;
    (sim * 100.0).round() as u8
}

/// Inputs to [`compute`]. Backwards-compatible: callers that don't
/// have a `repo_root` get the same behavior as the old API (no
/// body-similarity, name-only clustering).
pub struct Inputs<'a> {
    pub entries: &'a [CallTreeNode],
    /// D1: when provided, after name-based clusters are built we
    /// read each member's source range and compute a median token-
    /// shingle Jaccard. Clusters with low body similarity (< 0.5)
    /// get filtered out — they're likely name-only false positives
    /// like two unrelated `validate` methods.
    pub repo_root: Option<&'a std::path::Path>,
    /// D1: per-member function spans `(file, start_line, loc)`.
    /// `compute` reuses the `entries` walk so callers don't need to
    /// build this themselves — kept here for testability.
    pub line_spans: Option<&'a [(String, usize, usize)]>,
    /// Changed-file paths (repo-relative). After name-based and
    /// body-similarity filtering, a final pass keeps only clusters
    /// where AT LEAST ONE member's file is in the PR diff —
    /// duplicates that exist entirely in unchanged code are
    /// pre-existing dup, not actionable for this PR. Empty slice =
    /// no filter (legacy / unit-test callers).
    pub changed_files: &'a [String],
}

impl<'a> Default for Inputs<'a> {
    fn default() -> Self {
        Self {
            entries: &[],
            repo_root: None,
            line_spans: None,
            changed_files: &[],
        }
    }
}

/// D1: token-shingle Jaccard. Tokenizes by splitting on non-alnum
/// (keeps identifiers + numbers intact), shingles size 3.
fn token_shingles(text: &str) -> std::collections::HashSet<[String; 3]> {
    let tokens: Vec<String> = text
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|t| !t.is_empty())
        .map(|t| t.to_string())
        .collect();
    let mut out = std::collections::HashSet::new();
    if tokens.len() < 3 {
        return out;
    }
    for w in tokens.windows(3) {
        out.insert([w[0].clone(), w[1].clone(), w[2].clone()]);
    }
    out
}

fn jaccard(
    a: &std::collections::HashSet<[String; 3]>,
    b: &std::collections::HashSet<[String; 3]>,
) -> f64 {
    if a.is_empty() && b.is_empty() {
        return 0.0;
    }
    let inter = a.intersection(b).count() as f64;
    let union = a.union(b).count() as f64;
    if union == 0.0 {
        0.0
    } else {
        inter / union
    }
}

fn read_body(
    repo_root: &std::path::Path,
    file_rel: &str,
    line: usize,
    loc: usize,
) -> Option<String> {
    let path = repo_root.join(file_rel);
    let canonical_root = repo_root.canonicalize().ok()?;
    let canonical_path = path.canonicalize().ok()?;
    if !canonical_path.starts_with(&canonical_root) {
        return None;
    }
    let text = std::fs::read_to_string(&canonical_path).ok()?;
    let lines: Vec<&str> = text.lines().collect();
    if line == 0 || line > lines.len() {
        return None;
    }
    let start = line - 1;
    let end = (start + loc.max(1)).min(lines.len());
    Some(lines[start..end].join("\n"))
}

/// D2: bucket cluster severity from member-count + body-similarity.
fn severity_for(member_count: usize, body_sim: Option<f64>) -> String {
    let sim = body_sim.unwrap_or(0.0);
    // Three-way bucket: large clones → high; medium clones → medium; rest → low.
    if member_count >= 4 && sim >= 0.85 {
        "high".into()
    } else if member_count >= 3 || sim >= 0.75 {
        "medium".into()
    } else {
        "low".into()
    }
}

pub fn compute(entries: &[CallTreeNode]) -> DuplicationReport {
    compute_with(Inputs {
        entries,
        ..Default::default()
    })
}

pub fn compute_with(inputs: Inputs<'_>) -> DuplicationReport {
    let entries = inputs.entries;
    let pairs = walk_symbols(entries);
    let mut keep: Vec<(String, String)> = pairs
        .into_iter()
        .filter(|(n, _)| should_compare(n))
        .collect();
    // Truncate to the cap BEFORE the O(n²) loop so huge graphs can't
    // wedge CI. We sort first so the keep set is deterministic across
    // runs — without this, HashSet iteration order makes
    // `duplication_max_compare_candidates()` non-deterministic.
    keep.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
    keep.truncate(duplication_max_compare_candidates());
    let n = keep.len();
    let mut uf = UnionFind::new(n);
    let threshold = duplication_ratio_threshold();

    // Pre-compute character vectors once per candidate. Doing this
    // inside the inner loop was O(n² · len). Also fixes the
    // bytes-vs-chars mismatch where multi-byte UTF-8 identifiers
    // used to skip wrongly through the length pre-filter.
    let char_vecs: Vec<Vec<char>> = keep.iter().map(|(n, _)| n.chars().collect()).collect();

    for i in 0..n {
        let ai = &char_vecs[i];
        for j in (i + 1)..n {
            let bj = &char_vecs[j];
            // Bounded Levenshtein already short-circuits when
            // |len_a − len_b| exceeds max_dist, so no extra
            // pre-filter needed here. The early exit on max_dist
            // makes this loop O(n²) in count but O(1) per pair on
            // average (most pairs fail the bound after the first row).
            if ratio_with_threshold(ai, bj, threshold) >= threshold {
                uf.union(i, j);
            }
        }
    }

    // Build an index from (name, file) → CallTreeNode so D1 can
    // look up `line` + `loc` without re-walking.
    let span_lookup: HashMap<(String, String), (usize, usize)> = {
        let mut map: HashMap<(String, String), (usize, usize)> = HashMap::new();
        let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
        while let Some(n) = stack.pop() {
            map.insert((n.name.clone(), n.file.clone()), (n.line, n.loc));
            for c in &n.children {
                stack.push(c);
            }
        }
        map
    };

    let mut clusters_map: HashMap<usize, Vec<DuplicationMember>> = HashMap::new();
    for (idx, (name, file)) in keep.iter().enumerate() {
        let root = uf.find(idx);
        clusters_map.entry(root).or_default().push(DuplicationMember {
            name: name.clone(),
            file: file.clone(),
        });
    }

    let mut clusters: Vec<DuplicationCluster> = clusters_map
        .into_values()
        .filter(|members| members.len() >= 2)
        .map(|mut members| {
            members.sort_by(|a, b| a.name.cmp(&b.name));

            // D1: body-similarity Jaccard. Only when repo_root is
            // provided AND we can read at least 2 members' bodies.
            let body_similarity = if let Some(root) = inputs.repo_root {
                let mut bodies: Vec<std::collections::HashSet<[String; 3]>> = Vec::new();
                for m in &members {
                    let Some((line, loc)) = span_lookup.get(&(m.name.clone(), m.file.clone()))
                    else {
                        continue;
                    };
                    if let Some(text) = read_body(root, &m.file, *line, *loc) {
                        bodies.push(token_shingles(&text));
                    }
                }
                if bodies.len() < 2 {
                    None
                } else {
                    let mut sims: Vec<f64> = Vec::new();
                    for i in 0..bodies.len() {
                        for j in (i + 1)..bodies.len() {
                            sims.push(jaccard(&bodies[i], &bodies[j]));
                        }
                    }
                    sims.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                    Some(sims[sims.len() / 2])
                }
            } else {
                None
            };

            let member_count = members.len();
            let severity = Some(severity_for(member_count, body_similarity));
            DuplicationCluster {
                members,
                body_similarity,
                severity,
            }
        })
        // D1: drop clusters that have a measured body_similarity
        // below 0.5 — they're likely name-only collisions. Clusters
        // with `None` (no repo_root or unreadable files) keep the
        // pre-D1 behavior: they're retained.
        .filter(|c| match c.body_similarity {
            Some(s) => s >= 0.5,
            None => true,
        })
        // PR-scope filter: keep only clusters where ≥1 member's
        // file is in the PR diff. Clusters entirely inside
        // unchanged code are pre-existing dup, not introduced /
        // touched by this PR. Empty `changed_files` disables the
        // filter for legacy / unit-test callers.
        .filter(|c| {
            inputs.changed_files.is_empty()
                || c.members.iter().any(|m| {
                    crate::pr_algorithms::in_pr_changed_files(&m.file, inputs.changed_files)
                })
        })
        .collect();
    clusters.sort_by(|a, b| {
        b.members
            .len()
            .cmp(&a.members.len())
            .then_with(|| a.members[0].name.cmp(&b.members[0].name))
    });
    let count = clusters.len();

    DuplicationReport {
        threshold,
        clusters,
        count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::test_helpers::mk_node;
    fn node(name: &str, file: &str) -> crate::tree::CallTreeNode {
        mk_node(name, file)
    }

    #[test]
    fn finds_near_identical_pair() {
        // processOrder vs processOrders = 96% similar
        let entries = vec![
            node("processOrder", "a.rs"),
            node("processOrders", "b.rs"),
            node("totally_unrelated_long_function", "c.rs"),
        ];
        let r = compute(&entries);
        assert!(r.count >= 1, "expected a cluster, got {}", r.count);
    }

    /// PR-scope: clusters that exist entirely in unchanged files are
    /// dropped; clusters with ≥1 changed-file member are retained.
    #[test]
    fn clusters_scoped_to_changed_files() {
        // Two clusters: one entirely in unchanged code, one with a
        // member in changed code.
        let entries = vec![
            // Cluster A — both in unchanged files → drop
            node("oldDuplicate", "legacy/a.rs"),
            node("oldDuplicates", "legacy/b.rs"),
            // Cluster B — one member in changed file → keep
            node("touchedDup", "app/services.rs"),
            node("touchedDups", "app/other.rs"),
        ];
        let r = compute_with(Inputs {
            entries: &entries,
            changed_files: &["app/services.rs".to_string()],
            ..Default::default()
        });
        let names: Vec<&str> = r
            .clusters
            .iter()
            .flat_map(|c| c.members.iter().map(|m| m.name.as_str()))
            .collect();
        assert!(
            names.contains(&"touchedDup") && names.contains(&"touchedDups"),
            "expected cluster with changed-file member to be retained, got {names:?}",
        );
        assert!(
            !names.contains(&"oldDuplicate") && !names.contains(&"oldDuplicates"),
            "cluster entirely in unchanged code must be dropped, got {names:?}",
        );
    }

    /// Empty `changed_files` = no filter — legacy behavior preserved.
    #[test]
    fn empty_changed_files_disables_scope_filter() {
        let entries = vec![
            node("processOrder", "a.rs"),
            node("processOrders", "b.rs"),
        ];
        let r = compute_with(Inputs {
            entries: &entries,
            ..Default::default()
        });
        assert!(r.count >= 1, "empty changed_files must not filter");
    }

    #[test]
    fn skips_private_and_short_names() {
        let entries = vec![
            node("_foo", "a.rs"),
            node("_foo", "b.rs"),
            node("add", "c.rs"),
            node("ada", "d.rs"),
        ];
        let r = compute(&entries);
        assert_eq!(r.count, 0);
    }

    #[test]
    fn excludes_test_functions() {
        let entries = vec![
            node("test_create_user", "a.rs"),
            node("test_create_user_v2", "b.rs"),
        ];
        let r = compute(&entries);
        assert_eq!(r.count, 0);
    }

    #[test]
    fn threshold_is_95() {
        let r = compute(&[]);
        assert_eq!(r.threshold, 95);
    }

    /// Unicode regression: identifiers with multi-byte chars
    /// (`fetchΩData` vs `fetchΩDatas`) must NOT be skipped by the
    /// length pre-filter. Before the char-count fix, `Ω` (2 bytes)
    /// made the byte-length delta exceed the cap even though the
    /// char-length delta was 1.
    #[test]
    fn unicode_identifiers_compared_correctly() {
        let entries = vec![
            node("fetchΩData", "a.rs"),
            node("fetchΩDatas", "b.rs"),
        ];
        let r = compute(&entries);
        assert!(
            r.count >= 1,
            "expected unicode identifiers to cluster, got {} clusters",
            r.count
        );
    }

    /// DoS bound: when the candidate set exceeds the cap, compute()
    /// MUST return in bounded time. Input is 3000 distinct names —
    /// the cap (1500) + bounded-Levenshtein early-exit keep the
    /// inner loop's per-pair cost ~constant.
    #[test]
    fn huge_candidate_set_is_capped() {
        use std::time::Instant;
        let entries: Vec<_> = (0..3000)
            .map(|i| node(&format!("function_name_{i:04}"), "x.rs"))
            .collect();
        let start = Instant::now();
        let _r = compute(&entries);
        let elapsed = start.elapsed();
        // 1500² / 2 ≈ 1.1M pair comparisons. With bounded Levenshtein
        // most pairs exit after 1–2 DP rows. On a debug build with
        // a slow CI VM this should still complete in well under
        // 10 seconds; we allow margin so the test isn't flaky.
        assert!(
            elapsed.as_secs() < 30,
            "duplication took {elapsed:?} — cap/bounded-leven may not be applied",
        );
    }

    /// Same name in two locations forms a cluster (sanity for the
    /// trivial dup case the Union-Find must handle).
    #[test]
    fn same_name_two_files_clusters() {
        let entries = vec![
            node("processOrder", "a.rs"),
            node("processOrder", "b.rs"),
        ];
        let r = compute(&entries);
        assert!(r.count >= 1);
        assert_eq!(r.clusters[0].members.len(), 2);
    }
}
