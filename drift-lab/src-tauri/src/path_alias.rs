//! Infer a `(container_prefix → host_prefix)` path mapping from the
//! union of paths emitted by a live sampler vs. the paths a static
//! scan recorded.
//!
//! ## Why
//!
//! A profiler running inside a container reports paths like
//! `/app/orders.py` because the container's WORKDIR is `/app`. The
//! static scan ran on the host and recorded
//! `/Users/me/proj/test-python-web-server/orders.py`. `fuzzy_join`
//! still finds these via Tier-7 (basename + name) at confidence 0.50
//! — but that's the bottom of the matcher's reliable range. If we
//! can detect that *every* `/app/x` is actually
//! `/Users/me/proj/test-python-web-server/x`, we can rewrite the
//! sampled path in place and pop the confidence up to Tier-2 (0.95).
//!
//! ## Approach
//!
//! Try a small set of common container prefixes (`/app/`, `/code/`,
//! `/usr/src/app/`, …). For each:
//!
//!   1. Strip the prefix from each live path → relative tail.
//!   2. Find a static path that ENDS with `/<tail>` → that pair
//!      "votes" for a host prefix.
//!   3. Tally votes per host prefix. The most-voted host prefix is the
//!      candidate.
//!   4. Require coverage ≥ `MIN_COVERAGE` to avoid pinning an alias
//!      from a single coincidental match.
//!
//! Pick the (container, host) pair that explains the most live paths
//! overall. Ties broken by container-prefix length (longer = more
//! specific = preferred).
//!
//! ## What we deliberately *don't* do
//!
//! - Greedy multi-prefix support. A real container might bind-mount
//!   `/app` AND `/usr/local/lib`. For Phase 2 we settle for one
//!   dominant prefix; everything else falls back to Tier-7 matching.
//!   Multi-mount can be a Phase 3 feature if real data shows it
//!   matters.
//! - Inference from non-user frames. Stdlib paths
//!   (`/usr/lib/python3.7/...`) confuse the vote — they're real
//!   matches to a host path on the *same* runtime if the host has
//!   the same Python version, but we don't want a stdlib coincidence
//!   to pin the alias. Callers should pass `kind=user` frames only.

use std::collections::HashMap;

/// Container prefixes we'll try, longest first. Order matters: a
/// container with WORKDIR `/usr/src/app` should match against
/// `/usr/src/app/` BEFORE `/app/` (which doesn't appear in its paths)
/// — but if we ranked them by length descending the more-specific
/// prefix wins automatically when both are candidates.
const CANDIDATE_PREFIXES: &[&str] = &[
    "/usr/src/app/",
    "/usr/local/app/",
    "/home/app/",
    "/workspace/",
    "/srv/",
    "/code/",
    "/app/",
    "/www/",
    "/var/www/",
];

/// Minimum fraction of live paths a candidate must explain to be
/// considered a valid alias. 0.8 means "if 8/10 paths line up, ship
/// it; the 2 outliers are probably stdlib or third-party frames."
const MIN_COVERAGE: f32 = 0.8;

/// One detected prefix mapping. The semantic is:
///
///   for any live path P starting with `container_prefix`:
///     host_path = host_prefix + P[container_prefix.len()..]
///
/// Used to rewrite sampled file paths before the matcher runs so
/// Tier-1 (exact node_id) or Tier-2 (same file + same qualname) fires
/// instead of falling all the way to Tier-7.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PathAlias {
    pub container_prefix: String,
    pub host_prefix: String,
}

impl PathAlias {
    /// Rewrite `path` from container to host form. Returns the
    /// original `path` if it doesn't match the container prefix —
    /// the caller can apply the alias unconditionally on every
    /// sampled frame without thinking about whether it fits.
    pub fn apply<'a>(&self, path: &'a str) -> String {
        match path.strip_prefix(&self.container_prefix) {
            Some(rest) => {
                // `host_prefix` ends with `/`. `rest` is the tail
                // after `container_prefix` (also without leading `/`
                // since we strip the full `/app/` form). Concatenation
                // produces a valid POSIX path.
                let mut out = String::with_capacity(self.host_prefix.len() + rest.len());
                out.push_str(&self.host_prefix);
                out.push_str(rest);
                out
            }
            None => path.to_string(),
        }
    }
}

/// Attempt to infer an alias from the union of (sampled, static)
/// paths.
///
/// `sampled` should be a deduplicated list of file paths the live
/// sampler saw for user code (callers must filter stdlib /
/// site-packages — see module docs). `static_files` is the absolute-
/// path universe from the static scan.
///
/// Returns `None` when no candidate prefix clears `MIN_COVERAGE`. The
/// caller should fall back to the existing basename matcher in that
/// case.
pub fn infer(sampled: &[&str], static_files: &[&str]) -> Option<PathAlias> {
    if sampled.is_empty() || static_files.is_empty() {
        return None;
    }

    let mut best: Option<(PathAlias, usize)> = None;
    for prefix in CANDIDATE_PREFIXES {
        let matching: Vec<&str> = sampled
            .iter()
            .copied()
            .filter(|p| p.starts_with(prefix))
            .collect();
        if matching.is_empty() {
            continue;
        }

        // Tally host_prefix votes for this container_prefix.
        let mut host_votes: HashMap<String, usize> = HashMap::new();
        for live in &matching {
            let Some(tail) = live.strip_prefix(prefix) else {
                continue;
            };
            if tail.is_empty() {
                continue;
            }
            // Suffix-match: find a static path ending with `/<tail>`
            // (or equal to `<tail>` for the bare-relative-path case).
            let needle = format!("/{tail}");
            for stat in static_files {
                if stat.ends_with(&needle) {
                    // host_prefix = stat[.. stat.len() - tail.len()].
                    // That's "everything except the matched tail",
                    // including the final `/` so `apply()` can
                    // concatenate without a separator.
                    let host = &stat[..stat.len() - tail.len()];
                    *host_votes.entry(host.to_string()).or_insert(0) += 1;
                    break;
                }
            }
        }

        let Some((host_prefix, votes)) = host_votes
            .into_iter()
            .max_by_key(|(_, v)| *v)
        else {
            continue;
        };

        let coverage = votes as f32 / matching.len() as f32;
        if coverage < MIN_COVERAGE {
            continue;
        }

        let alias = PathAlias {
            container_prefix: (*prefix).to_string(),
            host_prefix,
        };

        // Higher vote count wins. Ties broken by container-prefix
        // length (longer = more specific). The CANDIDATE_PREFIXES
        // ordering already puts longer ones first, so iteration
        // order is the natural tie-break in that case.
        match &best {
            None => best = Some((alias, votes)),
            Some((_, bv)) if votes > *bv => best = Some((alias, votes)),
            _ => {}
        }
    }

    best.map(|(a, _)| a)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_alias_when_inputs_empty() {
        assert!(infer(&[], &["/host/x.py"]).is_none());
        assert!(infer(&["/app/x.py"], &[]).is_none());
        assert!(infer(&[], &[]).is_none());
    }

    #[test]
    fn no_alias_when_no_candidate_prefix_matches() {
        // None of /tmp, /var, /opt are in our candidate list. The
        // matcher should fail closed rather than guess.
        let sampled = ["/tmp/foo.py", "/var/log/bar.py"];
        let static_ = ["/host/proj/foo.py", "/host/proj/bar.py"];
        assert!(infer(&sampled, &static_).is_none());
    }

    #[test]
    fn detects_app_prefix_for_test_python_web_server() {
        // The user's real scenario: Docker container with WORKDIR
        // `/app/`, static scan ran on the host.
        let host = "/Users/me/test-python-web-server";
        let sampled = ["/app/orders.py", "/app/app.py"];
        let static_ = [
            format!("{host}/orders.py"),
            format!("{host}/app.py"),
        ];
        let static_refs: Vec<&str> = static_.iter().map(|s| s.as_str()).collect();
        let alias = infer(&sampled, &static_refs).expect("must detect /app/");
        assert_eq!(alias.container_prefix, "/app/");
        assert_eq!(alias.host_prefix, format!("{host}/"));
    }

    #[test]
    fn detects_usr_src_app_prefix() {
        let sampled = ["/usr/src/app/server.py", "/usr/src/app/db.py"];
        let static_ = [
            "/Users/me/svc/server.py",
            "/Users/me/svc/db.py",
        ];
        let alias = infer(&sampled, &static_).expect("must detect /usr/src/app/");
        assert_eq!(alias.container_prefix, "/usr/src/app/");
        assert_eq!(alias.host_prefix, "/Users/me/svc/");
    }

    #[test]
    fn rejects_alias_below_coverage_threshold() {
        // Only 1/4 paths match — below the 0.8 threshold. We refuse
        // rather than pin an alias on coincidence.
        let sampled = [
            "/app/orders.py",
            "/app/nope1.py",
            "/app/nope2.py",
            "/app/nope3.py",
        ];
        let static_ = ["/host/proj/orders.py"]; // only orders.py exists
        assert!(infer(&sampled, &static_).is_none());
    }

    #[test]
    fn accepts_alias_at_coverage_threshold() {
        // Exactly 4/5 → 0.8. Equal-to-threshold should pass.
        let sampled = [
            "/app/a.py",
            "/app/b.py",
            "/app/c.py",
            "/app/d.py",
            "/app/floater.py", // not in static
        ];
        let static_ = [
            "/host/proj/a.py",
            "/host/proj/b.py",
            "/host/proj/c.py",
            "/host/proj/d.py",
        ];
        let alias = infer(&sampled, &static_).expect("4/5 should clear 0.8");
        assert_eq!(alias.container_prefix, "/app/");
        assert_eq!(alias.host_prefix, "/host/proj/");
    }

    #[test]
    fn picks_most_specific_when_multiple_prefixes_could_match() {
        // Container has WORKDIR=/usr/src/app; static paths are under
        // /Users/me/svc/. A naive matcher might also try `/app/`,
        // but no live path starts with `/app/` here so only the
        // more-specific prefix can vote.
        let sampled = [
            "/usr/src/app/server.py",
            "/usr/src/app/sub/db.py",
        ];
        let static_ = ["/Users/me/svc/server.py", "/Users/me/svc/sub/db.py"];
        let alias = infer(&sampled, &static_).unwrap();
        assert_eq!(alias.container_prefix, "/usr/src/app/");
    }

    #[test]
    fn apply_rewrites_matching_path() {
        let alias = PathAlias {
            container_prefix: "/app/".into(),
            host_prefix: "/Users/me/test-python-web-server/".into(),
        };
        assert_eq!(
            alias.apply("/app/orders.py"),
            "/Users/me/test-python-web-server/orders.py",
        );
    }

    #[test]
    fn apply_passes_through_non_matching_path() {
        // Stdlib / site-packages frames don't start with `/app/`;
        // applying the alias must leave them untouched so the
        // matcher still sees the original path (and correctly
        // refuses to join them to user code).
        let alias = PathAlias {
            container_prefix: "/app/".into(),
            host_prefix: "/Users/me/proj/".into(),
        };
        let untouched = "/usr/lib/python3.7/asyncio/runners.py";
        assert_eq!(alias.apply(untouched), untouched);
    }

    #[test]
    fn apply_handles_nested_relative_paths() {
        // Container path: /app/services/orders.py
        //  → host       : /Users/me/proj/services/orders.py
        let alias = PathAlias {
            container_prefix: "/app/".into(),
            host_prefix: "/Users/me/proj/".into(),
        };
        assert_eq!(
            alias.apply("/app/services/orders.py"),
            "/Users/me/proj/services/orders.py",
        );
    }

    #[test]
    fn infer_then_apply_round_trip() {
        // End-to-end: infer the alias from a sample, then verify
        // applying it produces a path that exists in the static set.
        let sampled = ["/app/orders.py", "/app/app.py"];
        let static_ = [
            "/Users/me/test-python-web-server/orders.py",
            "/Users/me/test-python-web-server/app.py",
        ];
        let alias = infer(&sampled, &static_).unwrap();
        let host_path = alias.apply("/app/orders.py");
        assert!(static_.contains(&host_path.as_str()));
    }
}
