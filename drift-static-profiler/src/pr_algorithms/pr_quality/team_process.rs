//! pr_quality::team_process — reviewability / process health (higher = better).
//!
//! Two INDEPENDENT signals, deliberately NOT fused (PR_QUALITY_RESEARCH §8):
//! - **review_fatigue** — empirically-grounded PR-size reviewability
//!   (SmartBear/Cisco: ideal ≤200 LOC, overwhelms >400; Google: ~50 files
//!   too large). Smoothstep over LOC and files, `max` of the two (either
//!   axis kills review quality). THIS drives the dimension score.
//! - **knowledge_concentration** — a clearly-labeled STATIC "specialization /
//!   single-owner shape" approximation (Herfindahl over per-file churn).
//!   It is NOT CHAOSS bus factor (that needs git authorship), so it's
//!   ADVISORY context only and never drives the score or overclaims.

use super::{band_for, clamp01, smoothstep};
use crate::pr_algorithms::constants::pq_num;
use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::types::*;
use std::collections::BTreeMap;

pub struct Inputs<'a> {
    pub changed_files: &'a [ChangedFile],
}

pub fn compute(input: Inputs<'_>) -> QualityDimension {
    let files = input.changed_files.len();
    let loc: usize = input.changed_files.iter().map(|f| f.additions + f.deletions).sum();

    // ── review fatigue (the load-bearing, cited signal) ───────────────
    let fatigue_loc = smoothstep(
        loc as f64,
        pq_num("team.review_ideal_loc"),
        pq_num("team.review_max_loc"),
    );
    let fatigue_files = smoothstep(
        files as f64,
        pq_num("team.review_normal_files"),
        pq_num("team.review_too_many_files"),
    );
    let review_fatigue = fatigue_loc.max(fatigue_files); // either axis kills review quality

    // ── knowledge concentration (advisory, static-approx) ─────────────
    // Herfindahl index over per-file churn: 1.0 = all change in one file.
    let total_churn: usize = input.changed_files.iter().map(|f| f.additions + f.deletions).sum();
    let herfindahl = if total_churn == 0 {
        0.0
    } else {
        input
            .changed_files
            .iter()
            .map(|f| {
                let share = (f.additions + f.deletions) as f64 / total_churn as f64;
                share * share
            })
            .sum::<f64>()
    };
    let knowledge_concentration = clamp01(herfindahl);

    // Score = reviewability (1 − fatigue). Concentration is advisory only.
    let score = clamp01(1.0 - review_fatigue);

    let mut notes = vec![
        "Advisory — process signal, does not gate the merge.".to_string(),
        "knowledge_concentration is a STATIC specialization approximation \
         (Herfindahl over churn), NOT CHAOSS bus factor (needs git authorship)."
            .to_string(),
    ];
    if files <= 2 {
        notes.push("Few files changed — concentration index is not meaningful at this size.".into());
    }

    QualityDimension {
        score,
        band: band_for(score, true).to_string(),
        direction: if score >= 0.5 { Direction::Up } else { Direction::Down },
        confidence: Confidence::Medium,
        components: vec![
            QualityComponent {
                key: "review_fatigue".into(),
                value: round2(review_fatigue),
                weight: 1.0,
                detail: "PR-size reviewability (SmartBear 200/400 LOC, Google 50 files)".into(),
            },
            QualityComponent {
                key: "knowledge_concentration".into(),
                value: round2(knowledge_concentration),
                weight: 0.0, // advisory — does not drive the score
                detail: "static specialization approx (Herfindahl); not bus factor".into(),
            },
        ],
        formula: "team_process = 1 − review_fatigue;  review_fatigue = max(smoothstep(loc,200,400), smoothstep(files,10,50))"
            .into(),
        inputs: {
            let mut m = BTreeMap::new();
            m.insert("loc_changed".into(), InputValue::Number(loc as f64));
            m.insert("files_changed".into(), InputValue::Number(files as f64));
            m.insert("review_fatigue".into(), InputValue::Number(round2(review_fatigue)));
            m.insert("knowledge_concentration".into(), InputValue::Number(round2(knowledge_concentration)));
            m
        },
        kv: vec![],
        sources: vec![SourceCitation {
            label: "review size".into(),
            source: "SmartBear/Cisco study (≤200 ideal, >400 overwhelms) + Google eng-practices".into(),
            source_link: "https://google.github.io/eng-practices/review/developer/small-cls.html".into(),
        }],
        notes,
    }
}

fn round2(x: f64) -> f64 {
    let x = if x.is_finite() { x } else { 0.0 };
    (x * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cf(path: &str, loc: usize) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some("modified".into()),
            additions: loc,
            deletions: 0,
            ..Default::default()
        }
    }

    #[test]
    fn small_pr_is_reviewable() {
        let r = compute(Inputs { changed_files: &[cf("a.rs", 50)] });
        assert!(r.score > 0.9, "50-LOC 1-file PR should be highly reviewable: {}", r.score);
    }

    #[test]
    fn huge_pr_has_review_fatigue() {
        let r = compute(Inputs { changed_files: &[cf("a.rs", 1200)] });
        assert!(r.score < 0.2, "1200-LOC PR should show high fatigue: {}", r.score);
    }

    #[test]
    fn many_files_trigger_fatigue_even_at_modest_loc() {
        let files: Vec<ChangedFile> = (0..60).map(|i| cf(&format!("f{i}.rs"), 3)).collect();
        let r = compute(Inputs { changed_files: &files });
        assert!(r.score < 0.2, "60 files should fatigue review even at low LOC: {}", r.score);
    }

    #[test]
    fn concentration_is_advisory_not_scored() {
        // Two equal-churn files → Herfindahl 0.5, but score is driven by
        // fatigue (small PR → high score) regardless.
        let r = compute(Inputs { changed_files: &[cf("a.rs", 20), cf("b.rs", 20)] });
        assert!(r.score > 0.9, "concentration must not drag a small PR's score");
        let conc = r.components.iter().find(|c| c.key == "knowledge_concentration").unwrap();
        assert_eq!(conc.weight, 0.0, "concentration is advisory (weight 0)");
        assert!((conc.value - 0.5).abs() < 0.01, "two equal files → Herfindahl 0.5");
    }

    #[test]
    fn finite_on_empty() {
        let r = compute(Inputs { changed_files: &[] });
        assert!(r.score.is_finite() && (0.0..=1.0).contains(&r.score));
    }
}
