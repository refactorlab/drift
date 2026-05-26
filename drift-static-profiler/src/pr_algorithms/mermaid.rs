//! Structured mermaid representation + renderer.
//!
//! Every mermaid diagram drift emits lives here as a **typed struct**
//! and a **rendered string**. The rendered string is what the PR
//! comment embeds; the typed struct travels alongside in the JSON
//! output so future renderers (SVG / PNG / Graphviz / re-themed
//! mermaid) don't have to re-parse mermaid syntax.
//!
//! Single source of truth: every public type implements `render()`
//! that produces the mermaid string. The pipeline always BUILDS the
//! struct first, then calls `.render()` — string-and-struct can
//! never drift out of sync.
//!
//! Color palette mirrors `action/pr36-github-ui-example.html`'s use
//! of GitHub's dark-dimmed PR tokens, so the rendered diagrams
//! match the PR-comment chrome.

use serde::{Deserialize, Serialize};

// ─── GitHub PR color palette (canonical for our diagrams) ──────────
//
// Sourced from `action/pr36-github-ui-example.html`. These match
// GitHub's dark-dimmed theme so the mermaid blocks blend seamlessly
// when the bot posts them as PR comments.

pub mod colors {
    /// Added — green like a GitHub diff-add.
    pub const ADDED_FILL: &str = "#238636";
    pub const ADDED_STROKE: &str = "#3fb950";

    /// Removed — red like a GitHub diff-del.
    pub const REMOVED_FILL: &str = "#da3633";
    pub const REMOVED_STROKE: &str = "#f85149";

    /// Modified — amber for "changed but kept".
    pub const MODIFIED_FILL: &str = "#9e6a03";
    pub const MODIFIED_STROKE: &str = "#d29922";

    /// Data-structure card — new type definition.
    pub const DS_NEW_FILL: &str = "#1c2128";
    pub const DS_NEW_STROKE: &str = "#3fb950";

    /// Data-structure card — modified type.
    pub const DS_MOD_FILL: &str = "#1c2128";
    pub const DS_MOD_STROKE: &str = "#d29922";

    /// Scope (dashed amber box for PR slice in Image 2).
    pub const SCOPE_FILL: &str = "#1c2128";
    pub const SCOPE_STROKE: &str = "#d29922";

    /// Actor / user (start node).
    pub const ACTOR_FILL: &str = "#1f6feb";
    pub const ACTOR_STROKE: &str = "#2f81f7";

    /// Terminal action (end node — "developer deploys").
    pub const ACTION_FILL: &str = "#238636";
    pub const ACTION_STROKE: &str = "#3fb950";

    /// Muted (placeholder / before-state, side-effect category nodes).
    pub const MUTED_FILL: &str = "#6e7681";
    pub const MUTED_STROKE: &str = "#8b949e";

    /// Default node text on dark theme.
    pub const FG_DEFAULT: &str = "#e6edf3";
    pub const FG_ON_FILL: &str = "#fff";

    /// xychart-beta palette — green for positive bars, red for negative.
    pub const XYCHART_PALETTE: &str = "#22c55e,#ef4444";
}

// ─── Flowchart (Images 1 + 2) ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flowchart {
    pub direction: FlowDirection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub subgraphs: Vec<Subgraph>,
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
    pub class_defs: Vec<ClassDef>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FlowDirection {
    LR,
    RL,
    TB,
    BT,
}

impl FlowDirection {
    fn as_str(self) -> &'static str {
        match self {
            FlowDirection::LR => "LR",
            FlowDirection::RL => "RL",
            FlowDirection::TB => "TB",
            FlowDirection::BT => "BT",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub shape: NodeShape,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub class: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum NodeShape {
    #[default]
    Rect,
    Round,
    Stadium,
    Circle,
    Subroutine,
    Decision,
    /// Double-circle for actors / users (`(( ))`).
    Actor,
}

impl NodeShape {
    /// Returns the opening and closing brackets for this shape.
    /// e.g. `Rect` → `("[", "]")`, `Round` → `("(", ")")`.
    fn brackets(self) -> (&'static str, &'static str) {
        match self {
            NodeShape::Rect => ("[", "]"),
            NodeShape::Round => ("(", ")"),
            NodeShape::Stadium => ("([", "])"),
            NodeShape::Circle => ("((", "))"),
            NodeShape::Subroutine => ("[[", "]]"),
            NodeShape::Decision => ("{", "}"),
            NodeShape::Actor => ("((", "))"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEdge {
    pub from: String,
    pub to: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default)]
    pub style: EdgeStyle,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum EdgeStyle {
    #[default]
    Solid,
    Dashed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subgraph {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub direction: Option<FlowDirection>,
    /// IDs of nodes contained in this subgraph. Must reference nodes
    /// declared in the parent `Flowchart.nodes`.
    pub node_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassDef {
    pub name: String,
    pub fill: String,
    pub stroke: String,
    pub color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_width: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_dasharray: Option<String>,
}

/// Replace mermaid-syntax-breakers in a label. `[`, `]`, `(`, `)`,
/// `{`, `}` would otherwise be interpreted as node-shape delimiters
/// or subgraph syntax. Newlines and quotes likewise break parsing.
fn safe_label(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '[' | ']' | '(' | ')' | '{' | '}' | '"' | '\\' | '\n' | '\r' => ' ',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect()
}

impl Flowchart {
    pub fn render(&self) -> String {
        let mut out = String::new();
        out.push_str(&format!("flowchart {}", self.direction.as_str()));
        out.push('\n');
        if let Some(title) = &self.title {
            out.push_str(&format!("    %% {}\n", safe_label(title)));
        }

        // Subgraphs first (with their nodes inline)
        let mut emitted: std::collections::HashSet<&str> = std::collections::HashSet::new();
        for sg in &self.subgraphs {
            out.push_str(&format!("    subgraph {}[\"{}\"]\n", sg.id, safe_label(&sg.label)));
            if let Some(d) = sg.direction {
                out.push_str(&format!("        direction {}\n", d.as_str()));
            }
            for nid in &sg.node_ids {
                if let Some(n) = self.nodes.iter().find(|n| &n.id == nid) {
                    out.push_str("        ");
                    out.push_str(&render_node(n));
                    out.push('\n');
                    emitted.insert(&n.id);
                }
            }
            out.push_str("    end\n");
        }

        // Standalone nodes (not in any subgraph)
        for n in &self.nodes {
            if !emitted.contains(n.id.as_str()) {
                out.push_str("    ");
                out.push_str(&render_node(n));
                out.push('\n');
            }
        }

        // Edges
        for e in &self.edges {
            let arrow = match e.style {
                EdgeStyle::Solid => "-->",
                EdgeStyle::Dashed => "-.->",
            };
            match &e.label {
                Some(lbl) => out.push_str(&format!(
                    "    {} {}|{}|{}\n",
                    e.from,
                    arrow,
                    safe_label(lbl),
                    e.to,
                )),
                None => out.push_str(&format!("    {} {} {}\n", e.from, arrow, e.to)),
            }
        }

        // classDef declarations
        for cd in &self.class_defs {
            let mut parts = vec![
                format!("fill:{}", cd.fill),
                format!("stroke:{}", cd.stroke),
                format!("color:{}", cd.color),
            ];
            if let Some(w) = &cd.stroke_width {
                parts.push(format!("stroke-width:{w}"));
            }
            if let Some(d) = &cd.stroke_dasharray {
                parts.push(format!("stroke-dasharray:{d}"));
            }
            out.push_str(&format!("    classDef {} {}\n", cd.name, parts.join(",")));
        }

        // class assignments (group nodes that share a class for compact output)
        let mut by_class: std::collections::BTreeMap<&str, Vec<&str>> =
            std::collections::BTreeMap::new();
        for n in &self.nodes {
            if let Some(c) = &n.class {
                by_class.entry(c.as_str()).or_default().push(&n.id);
            }
        }
        for (class, ids) in by_class {
            out.push_str(&format!("    class {} {}\n", ids.join(","), class));
        }

        out.trim_end().to_string()
    }
}

fn render_node(n: &FlowNode) -> String {
    let (open, close) = n.shape.brackets();
    format!("{}{}{}{}", n.id, open, safe_label(&n.label), close)
}

// ─── QuadrantChart (Image 4 risks) ─────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadrantChart {
    pub title: String,
    pub x_axis_low: String,
    pub x_axis_high: String,
    pub y_axis_low: String,
    pub y_axis_high: String,
    pub quadrant_1: String,
    pub quadrant_2: String,
    pub quadrant_3: String,
    pub quadrant_4: String,
    pub items: Vec<QuadrantItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadrantItem {
    pub label: String,
    /// Likelihood in [0, 1].
    pub x: f64,
    /// Severity in [0, 1].
    pub y: f64,
}

fn sanitize_unit(x: f64) -> f64 {
    if x.is_finite() {
        x.clamp(0.0, 1.0)
    } else {
        0.0
    }
}

/// Quote-escape for quadrantChart item labels (`"..."` syntax).
fn safe_quoted(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_control() {
                ' '
            } else if c == '"' {
                '\''
            } else if c == '\\' {
                '/'
            } else {
                c
            }
        })
        .collect()
}

impl QuadrantChart {
    pub fn render(&self) -> String {
        let mut out = String::from("quadrantChart\n");
        out.push_str(&format!("    title {}\n", safe_label(&self.title)));
        out.push_str(&format!(
            "    x-axis {} --> {}\n",
            safe_label(&self.x_axis_low),
            safe_label(&self.x_axis_high)
        ));
        out.push_str(&format!(
            "    y-axis {} --> {}\n",
            safe_label(&self.y_axis_low),
            safe_label(&self.y_axis_high)
        ));
        out.push_str(&format!("    quadrant-1 {}\n", safe_label(&self.quadrant_1)));
        out.push_str(&format!("    quadrant-2 {}\n", safe_label(&self.quadrant_2)));
        out.push_str(&format!("    quadrant-3 {}\n", safe_label(&self.quadrant_3)));
        out.push_str(&format!("    quadrant-4 {}\n", safe_label(&self.quadrant_4)));
        for it in &self.items {
            let x = sanitize_unit(it.x);
            let y = sanitize_unit(it.y);
            out.push_str(&format!(
                "    \"{}\": [{:.2}, {:.2}]\n",
                safe_quoted(&it.label),
                x,
                y
            ));
        }
        out.trim_end().to_string()
    }
}

// ─── XyChart (Image 3 bars) ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XyChart {
    pub title: String,
    pub theme_palette: String,
    pub x_axis_labels: Vec<String>,
    pub y_axis_label: String,
    pub y_min: f64,
    pub y_max: f64,
    pub bars: Vec<f64>,
}

impl XyChart {
    pub fn render(&self) -> String {
        let mut out = String::new();
        out.push_str(&format!(
            "%%{{init: {{'theme':'base', 'themeVariables': {{'xyChart': {{'plotColorPalette': '{}'}}}}}}}}%%\n",
            self.theme_palette
        ));
        out.push_str("xychart-beta\n");
        out.push_str(&format!("    title \"{}\"\n", safe_quoted(&self.title)));
        let labels = self
            .x_axis_labels
            .iter()
            .map(|l| format!("\"{}\"", safe_quoted(l)))
            .collect::<Vec<_>>()
            .join(", ");
        out.push_str(&format!("    x-axis [{labels}]\n"));
        out.push_str(&format!(
            "    y-axis \"{}\" {} --> {}\n",
            safe_quoted(&self.y_axis_label),
            self.y_min,
            self.y_max
        ));
        let values = self
            .bars
            .iter()
            .map(|v| {
                let clamped = if v.is_finite() {
                    v.clamp(self.y_min, self.y_max)
                } else {
                    0.0
                };
                format!("{clamped:.1}")
            })
            .collect::<Vec<_>>()
            .join(", ");
        out.push_str(&format!("    bar [{values}]\n"));
        out.trim_end().to_string()
    }
}

// ─── Mindmap (Image 4 key files) ───────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mindmap {
    pub root: MindmapNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MindmapNode {
    pub label: String,
    /// Whether to render this node as a "root" circle `((...))` vs a
    /// plain leaf label. Only meaningful for the actual root.
    #[serde(default)]
    pub is_root: bool,
    #[serde(default)]
    pub children: Vec<MindmapNode>,
}

impl Mindmap {
    pub fn render(&self) -> String {
        let mut out = String::from("mindmap\n");
        self.root.render_into(&mut out, 1);
        out.trim_end().to_string()
    }
}

impl MindmapNode {
    fn render_into(&self, out: &mut String, depth: usize) {
        let indent = "  ".repeat(depth);
        if self.is_root {
            out.push_str(&format!("{indent}root(({}))\n", safe_label(&self.label)));
        } else {
            out.push_str(&format!("{indent}{}\n", safe_label(&self.label)));
        }
        for c in &self.children {
            c.render_into(out, depth + 1);
        }
    }
}

// ─── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flowchart_with_subgraphs_and_classes_renders() {
        let fc = Flowchart {
            direction: FlowDirection::LR,
            title: None,
            subgraphs: vec![Subgraph {
                id: "BEFORE".into(),
                label: "🔴 Before".into(),
                direction: Some(FlowDirection::LR),
                node_ids: vec!["a".into(), "b".into()],
            }],
            nodes: vec![
                FlowNode { id: "a".into(), label: "Old".into(), shape: NodeShape::Rect, class: Some("removed".into()) },
                FlowNode { id: "b".into(), label: "Renamed".into(), shape: NodeShape::Rect, class: Some("modified".into()) },
                FlowNode { id: "c".into(), label: "New".into(), shape: NodeShape::Rect, class: Some("added".into()) },
            ],
            edges: vec![
                FlowEdge { from: "a".into(), to: "b".into(), label: None, style: EdgeStyle::Solid },
                FlowEdge { from: "b".into(), to: "c".into(), label: Some("evolves".into()), style: EdgeStyle::Dashed },
            ],
            class_defs: vec![
                ClassDef {
                    name: "added".into(),
                    fill: colors::ADDED_FILL.into(),
                    stroke: colors::ADDED_STROKE.into(),
                    color: colors::FG_ON_FILL.into(),
                    stroke_width: Some("2px".into()),
                    stroke_dasharray: None,
                },
            ],
        };
        let s = fc.render();
        assert!(s.starts_with("flowchart LR"));
        assert!(s.contains("subgraph BEFORE"));
        assert!(s.contains("a[Old]"));
        assert!(s.contains("c[New]"));
        assert!(s.contains("a --> b"));
        assert!(s.contains("b -.->|evolves|c"));
        assert!(s.contains("classDef added fill:#238636,stroke:#3fb950"));
        assert!(s.contains("class c added"), "class assignment missing in:\n{s}");
    }

    #[test]
    fn quadrantchart_renders_with_clamped_coords() {
        let q = QuadrantChart {
            title: "Risk Map".into(),
            x_axis_low: "Low likelihood".into(),
            x_axis_high: "High likelihood".into(),
            y_axis_low: "Low severity".into(),
            y_axis_high: "High severity".into(),
            quadrant_1: "Act before merge".into(),
            quadrant_2: "Monitor closely".into(),
            quadrant_3: "Acceptable".into(),
            quadrant_4: "Document & ship".into(),
            items: vec![
                QuadrantItem { label: "PR size".into(), x: 0.85, y: 0.9 },
                QuadrantItem { label: "Bad NaN".into(), x: f64::NAN, y: 2.0 }, // clamps to 0, 1
            ],
        };
        let s = q.render();
        assert!(s.contains("quadrantChart"));
        assert!(s.contains("\"PR size\": [0.85, 0.90]"));
        assert!(s.contains("\"Bad NaN\": [0.00, 1.00]"));
    }

    #[test]
    fn xychart_renders_with_palette() {
        let x = XyChart {
            title: "PR drift".into(),
            theme_palette: colors::XYCHART_PALETTE.into(),
            x_axis_labels: vec!["Money".into(), "Customer".into()],
            y_axis_label: "Drift %".into(),
            y_min: -50.0,
            y_max: 100.0,
            bars: vec![32.0, 48.0],
        };
        let s = x.render();
        assert!(s.contains("xychart-beta"));
        assert!(s.contains("plotColorPalette"));
        assert!(s.contains("[\"Money\", \"Customer\"]"));
        assert!(s.contains("bar [32.0, 48.0]"));
    }

    #[test]
    fn mindmap_renders_nested_structure() {
        let m = Mindmap {
            root: MindmapNode {
                label: "PR hot files".into(),
                is_root: true,
                children: vec![MindmapNode {
                    label: "Wire format".into(),
                    is_root: false,
                    children: vec![MindmapNode {
                        label: "compact.rs".into(),
                        is_root: false,
                        children: vec![],
                    }],
                }],
            },
        };
        let s = m.render();
        assert!(s.starts_with("mindmap"));
        assert!(s.contains("root((PR hot files))"));
        assert!(s.contains("Wire format"));
        assert!(s.contains("compact.rs"));
    }

    #[test]
    fn safe_label_strips_mermaid_breakers() {
        assert_eq!(safe_label("foo[bar](x)"), "foo bar  x ");
        // Newline AND tab are control chars per Rust's `is_control`;
        // both become spaces. Mermaid label content shouldn't contain
        // either anyway.
        assert_eq!(safe_label("a\nb\tc"), "a b c");
        assert!(!safe_label("evil\"quote").contains('"'));
    }
}
