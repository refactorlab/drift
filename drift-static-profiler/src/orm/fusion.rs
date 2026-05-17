//! Fusion / triangulation: when an ORM-level rule and an SQL-IR rule
//! both fire at overlapping byte ranges, combine them into one finding
//! with multiplicative-complement confidence.
//!
//! Reasoning: each layer is an independent evidence stream. If P(ORM
//! rule wrong) = 1−c1 and P(SQL-IR rule wrong) = 1−c2 are independent,
//! then P(both wrong) = (1−c1)(1−c2) and combined confidence = 1 −
//! (1−c1)(1−c2). Example: 0.85 + 0.75 → 1 − 0.15·0.25 = 0.9625.

use crate::insights::{Evidence, Finding};
use std::ops::Range;

fn overlaps(a: &Range<usize>, b: &Range<usize>) -> bool {
    a.start < b.end && b.start < a.end
}

/// Merge ORM-level + SQL-IR findings. Inputs are mutated by reference
/// only conceptually — implementation drains both and returns the fused
/// list. Sole-firing findings pass through unchanged.
pub fn fuse_findings(orm: Vec<Finding>, sql_ir: Vec<Finding>) -> Vec<Finding> {
    let mut out: Vec<Finding> = Vec::with_capacity(orm.len() + sql_ir.len());
    let mut sql_consumed = vec![false; sql_ir.len()];

    for o in orm {
        let o_range = o.byte_range.clone();
        let mut fused = o;
        if let Some(r) = &o_range {
            for (i, s) in sql_ir.iter().enumerate() {
                if sql_consumed[i] {
                    continue;
                }
                let Some(sr) = &s.byte_range else { continue };
                if overlaps(r, sr) {
                    // Combine
                    let c1 = fused.confidence.clamp(0.0, 1.0);
                    let c2 = s.confidence.clamp(0.0, 1.0);
                    fused.confidence = 1.0 - (1.0 - c1) * (1.0 - c2);
                    // Take the stricter severity.
                    if severity_rank(s.severity) > severity_rank(fused.severity) {
                        fused.severity = s.severity;
                    }
                    for fp in &s.fusion_paths {
                        if !fused.fusion_paths.contains(fp) {
                            fused.fusion_paths.push(fp.clone());
                        }
                    }
                    // Union evidence rows (dedup by (call,line)).
                    for e in &s.evidence {
                        if !fused
                            .evidence
                            .iter()
                            .any(|x| x.call == e.call && x.line == e.line)
                        {
                            fused.evidence.push(Evidence {
                                call: e.call.clone(),
                                line: e.line,
                                category: e.category,
                            });
                        }
                    }
                    if fused.predicted_sql.is_none() && s.predicted_sql.is_some() {
                        fused.predicted_sql = s.predicted_sql.clone();
                    }
                    if fused.fidelity.is_none() && s.fidelity.is_some() {
                        fused.fidelity = s.fidelity;
                    }
                    sql_consumed[i] = true;
                }
            }
        }
        out.push(fused);
    }

    // Sole-firing SQL-IR findings pass through.
    for (i, s) in sql_ir.into_iter().enumerate() {
        if !sql_consumed[i] {
            out.push(s);
        }
    }

    out
}

fn severity_rank(s: crate::insights::Severity) -> u8 {
    use crate::insights::Severity::*;
    match s {
        Low => 0,
        Medium => 1,
        High => 2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::insights::{FindingKind, Severity};

    fn make(conf: f64, range: Range<usize>, rule: &str) -> Finding {
        Finding {
            kind: FindingKind::DjangoAntipattern,
            severity: Severity::Medium,
            effort: crate::insights::Effort::Small,
            confidence: conf,
            line: 1,
            message: "test".into(),
            evidence: vec![Evidence {
                call: rule.into(),
                line: 1,
                category: None,
            }],
            remediation: None,
            byte_range: Some(range),
            fidelity: None,
            fusion_paths: vec![rule.into()],
            predicted_sql: None,
            originating_orm: None,
        }
    }

    #[test]
    fn overlapping_findings_triangulate() {
        let o = vec![make(0.85, 100..200, "DJ-N1-001")];
        let s = vec![make(0.75, 150..250, "SQLIR-011")];
        let out = fuse_findings(o, s);
        assert_eq!(out.len(), 1, "overlapping findings must fuse");
        let c = out[0].confidence;
        // 1 - (1-0.85)*(1-0.75) = 1 - 0.15*0.25 = 0.9625
        assert!(
            (c - 0.9625).abs() < 1e-6,
            "expected ~0.9625, got {c}"
        );
        assert_eq!(out[0].fusion_paths.len(), 2);
    }

    #[test]
    fn disjoint_findings_pass_through() {
        let o = vec![make(0.85, 100..200, "DJ-N1-001")];
        let s = vec![make(0.75, 300..400, "SQLIR-011")];
        let out = fuse_findings(o, s);
        assert_eq!(out.len(), 2);
    }

    #[test]
    fn solo_firing_unchanged() {
        let o: Vec<Finding> = vec![];
        let s = vec![make(0.75, 100..200, "SQLIR-001")];
        let out = fuse_findings(o, s);
        assert_eq!(out.len(), 1);
        assert!((out[0].confidence - 0.75).abs() < 1e-6);
    }
}
