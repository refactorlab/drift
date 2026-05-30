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

/// Substituted for any label that sanitizes to empty/blank. Mermaid REJECTS
/// an empty quoted label (`n0[""]`, `subgraph S[""]`, `"": [..]`, `root(())`),
/// so a label that was all-punctuation (e.g. an anonymous symbol) must still
/// render to *something*. A middot reads as "unnamed".
const LABEL_PLACEHOLDER: &str = "·";

/// Cap label rendering at this many chars. Real-world generic chains in Rust
/// or C++ can be 500+ chars (`Result<Vec<Box<dyn Trait + Send + 'static>>, …>`),
/// which technically parses but blows out GitHub's diagram layout and is
/// unreadable. Truncate with an ellipsis well below the parser's limit. The
/// cap counts Unicode SCALAR VALUES so multi-byte glyphs survive intact.
const LABEL_MAX_CHARS: usize = 120;

/// Mermaid keywords that abort the parse if used as a bare node/subgraph id
/// (e.g. a node literally named `end` closes the enclosing subgraph). `safe_id`
/// suffixes `_` to neutralize them. Compared case-insensitively.
const MERMAID_RESERVED_IDS: &[&str] = &[
    "end", "graph", "subgraph", "flowchart", "class", "classdef", "click", "style", "linkstyle",
    "direction", "default", "call", "href", "interpolate",
];

/// Replace mermaid-syntax-breakers in a QUOTED label (`"…"` contexts: flow
/// nodes, subgraph titles, mindmap nodes). `[`, `]`, `(`, `)`, `{`, `}` would
/// otherwise be read as node-shape delimiters; newlines and quotes break the
/// quoting. `<`/`>` map to look-alike guillemets (`‹`/`›`) because Mermaid's
/// htmlLabels renderer treats `<…>` inside a quoted label as an HTML tag and
/// silently drops it, and an UNquoted `<`/`@` is tokenized as an operator (the
/// `@` becomes a `LINK_ID`, aborting the parse). This is what makes synthetic
/// names like `<module>` and `useTheme.<lambda@21>` safe to display verbatim.
///
/// GUARANTEE: the result is never empty/blank — see `LABEL_PLACEHOLDER`.
fn safe_label(s: &str) -> String {
    let mapped: String = s
        .chars()
        .map(|c| match c {
            '[' | ']' | '(' | ')' | '{' | '}' | '"' | '\\' | '\n' | '\r' => ' ',
            '<' => '‹',
            '>' => '›',
            // Mermaid v11 quoted labels activate MARKDOWN-STRING mode on
            // backticks (an unbalanced or triple ``` aborts the parse). We
            // never want markdown formatting in symbol/file labels, so map
            // backticks to apostrophes — visually similar, no markdown risk.
            '`' => '\'',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect();
    non_empty(mapped)
}

/// Edge labels live inside `-->|…|`, so a literal `|` would prematurely close
/// the label and corrupt the edge. Everything else is `safe_label`'s job.
fn safe_edge_label(s: &str) -> String {
    safe_label(s).replace('|', "/")
}

/// Sanitize an arbitrary string into a mermaid-safe NODE/SUBGRAPH ID. Node ids
/// are emitted bare (unquoted), referenced by edges and `class` lines, so they
/// must be `[A-Za-z0-9_]`, non-empty, not digit-leading, and not a reserved
/// keyword. Deterministic: the same raw id always maps to the same safe id, so
/// declarations and references stay in lock-step. Synthetic builder ids
/// (`n0`, `a_n0`, `ds_0`, `BEFORE`) pass through unchanged.
fn safe_id(s: &str) -> String {
    let mut out: String = s
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' })
        .collect();
    if out.is_empty() {
        out.push('_');
    }
    // Mermaid's flowchart grammar can misparse a digit-leading id; prefix it.
    if out.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        out.insert(0, 'n');
    }
    if MERMAID_RESERVED_IDS.contains(&out.to_ascii_lowercase().as_str()) {
        out.push('_');
    }
    out
}

/// Collapse an empty/whitespace-only label to the placeholder, then truncate
/// to `LABEL_MAX_CHARS` (counted in Unicode scalars) with a trailing ellipsis.
fn non_empty(s: String) -> String {
    let s = if s.trim().is_empty() { LABEL_PLACEHOLDER.to_string() } else { s };
    truncate_chars(s, LABEL_MAX_CHARS)
}

/// Truncate to at most `max` chars (Unicode scalar values, not bytes — so
/// multi-byte glyphs like emoji aren't split mid-codepoint) appending `…`
/// when shortened. Pass-through when already short enough.
fn truncate_chars(s: String, max: usize) -> String {
    if s.chars().count() <= max {
        return s;
    }
    let head: String = s.chars().take(max.saturating_sub(1)).collect();
    format!("{head}…")
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
            out.push_str(&format!("    subgraph {}[\"{}\"]\n", safe_id(&sg.id), safe_label(&sg.label)));
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
            let (from, to) = (safe_id(&e.from), safe_id(&e.to));
            match &e.label {
                // QUOTE edge labels — otherwise mermaid tokenizes `@` inside
                // `|…|` as a LINK_ID and aborts the parse (the same family of
                // bug as the original `useTheme.<lambda@21>` node-label break).
                // `safe_edge_label` has already neutralized `"`, `|`, control
                // chars, and guaranteed a non-empty label.
                Some(lbl) => out.push_str(&format!(
                    "    {} {}|\"{}\"|{}\n",
                    from,
                    arrow,
                    safe_edge_label(lbl),
                    to,
                )),
                None => out.push_str(&format!("    {} {} {}\n", from, arrow, to)),
            }
        }

        // classDef declarations — the NAME is also bare in mermaid syntax, so a
        // reserved-word class name (`classDef end fill:…`) aborts the parse.
        // Sanitize via `safe_id` so the class line and any `class … name`
        // reference below resolve to the same identifier.
        //
        // Skip classDefs no node actually references. An orphan classDef is
        // legal mermaid but it's dead output that bloats diff noise and leaks
        // the builder's intent (the broken architecture-flow output emitted
        // a `changed` classDef no node used because zero roots matched
        // `changed_files`). Keeping only the referenced classDefs makes the
        // wire format match exactly what the diagram needs.
        let used_classes: std::collections::HashSet<&str> = self
            .nodes
            .iter()
            .filter_map(|n| n.class.as_deref())
            .collect();
        for cd in self.class_defs.iter().filter(|cd| used_classes.contains(cd.name.as_str())) {
            // Each field value is sanitized via `safe_class_value` so a hostile
            // upstream can't inject extra keys (comma) or terminate the line
            // early (newline) or use `rgb(…)`/`hsl(…)` syntax mermaid rejects.
            let mut parts = vec![
                format!("fill:{}", safe_class_value(&cd.fill)),
                format!("stroke:{}", safe_class_value(&cd.stroke)),
                format!("color:{}", safe_class_value(&cd.color)),
            ];
            if let Some(w) = &cd.stroke_width {
                parts.push(format!("stroke-width:{}", safe_class_value(w)));
            }
            if let Some(d) = &cd.stroke_dasharray {
                parts.push(format!("stroke-dasharray:{}", safe_class_value(d)));
            }
            out.push_str(&format!("    classDef {} {}\n", safe_id(&cd.name), parts.join(",")));
        }

        // class assignments (group nodes that share a class for compact output).
        // BOTH the node ids AND the class name are sanitized via `safe_id` so
        // they match the declarations exactly.
        let mut by_class: std::collections::BTreeMap<&str, Vec<String>> =
            std::collections::BTreeMap::new();
        for n in &self.nodes {
            if let Some(c) = &n.class {
                by_class.entry(c.as_str()).or_default().push(safe_id(&n.id));
            }
        }
        for (class, ids) in by_class {
            out.push_str(&format!("    class {} {}\n", ids.join(","), safe_id(class)));
        }

        out.trim_end().to_string()
    }
}

fn render_node(n: &FlowNode) -> String {
    let (open, close) = n.shape.brackets();
    // Quote the label so spaces, dots, `@`, `#` and other punctuation in
    // synthetic symbol names (`useTheme.<lambda@21>`) are parsed as
    // literal text rather than Mermaid operators. `safe_label` has
    // already neutralized embedded quotes and `<`/`>` and guaranteed a
    // non-empty label; `safe_id` guarantees a keyword-safe id.
    format!("{}{}\"{}\"{}", safe_id(&n.id), open, safe_label(&n.label), close)
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

/// Empirically-determined safe range for quadrantChart coordinates in mermaid
/// v11: the parser accepts `[0.0, 1.0)` (a CLOSED lower bound, OPEN upper),
/// AND `{:.2}` rounding means anything ≥ 0.995 formats to "1.00" — which the
/// parser also rejects. So we clamp to 0.99 to guarantee both invariants.
/// Caught in production: a real-repo risk with severity = 1.00 aborted the
/// diagram parse — fix landed alongside the integration test that reproduces it.
const QUADRANT_UNIT_MAX: f64 = 0.99;

/// Default xychart palette — used when `theme_palette` arrives malformed (e.g.
/// via a tampered/legacy JSON `*_structured` block). Matches `colors::XYCHART_PALETTE`.
const DEFAULT_XYCHART_PALETTE: &str = "#22c55e,#ef4444";

/// Sanitize one classDef field value (`fill`, `stroke`, `color`,
/// `stroke-width`, `stroke-dasharray`). Empirically:
///   - `rgb(0,0,0)`, `rgba(…)`, `hsl(…)`, `var(--c)` → mermaid's classDef
///     parser FAILS on `(` / `)`.
///   - `\n` / `\r` would terminate the classDef line early and could inject.
///   - `,` would add an extra key=value pair (silently changes styling).
/// Strip those; keep everything else verbatim so hex colors / named colors /
/// dasharray digits-and-spaces all survive. Reachable through JSON re-render.
fn safe_class_value(s: &str) -> String {
    s.chars()
        .filter(|c| !matches!(c, '(' | ')' | '\n' | '\r' | ','))
        .collect()
}

/// Sanitize `theme_palette` against directive-injection. The value is
/// interpolated VERBATIM into a `%%{init: { … 'plotColorPalette': '<HERE>' } }%%`
/// directive — a `}`, newline, or quote in it can break out and produce
/// arbitrary mermaid below. Defense-in-depth: allow only hex/comma/`#`/space
/// (the legitimate palette alphabet); fall back to the default otherwise.
fn safe_palette(s: &str) -> String {
    if s.is_empty()
        || s.chars().any(|c| !matches!(c, '0'..='9' | 'a'..='f' | 'A'..='F' | '#' | ',' | ' '))
    {
        return DEFAULT_XYCHART_PALETTE.to_string();
    }
    s.to_string()
}

fn sanitize_unit(x: f64) -> f64 {
    if x.is_finite() {
        x.clamp(0.0, QUADRANT_UNIT_MAX)
    } else {
        0.0
    }
}

/// Quote-escape for quadrantChart / xychart labels (`"..."` syntax). Like
/// `safe_label` but for the `"`-quoted dialects: an embedded `"` becomes `'`.
/// GUARANTEE: never empty/blank (mermaid rejects `"": [..]` and `x-axis [""]`).
fn safe_quoted(s: &str) -> String {
    let mapped: String = s
        .chars()
        .map(|c| {
            if c.is_control() {
                ' '
            } else if c == '"' {
                '\''
            } else if c == '\\' {
                '/'
            } else if c == '<' {
                // Same htmlLabels hazard as safe_label — keep `<module>`
                // and friends from being parsed as HTML tags.
                '‹'
            } else if c == '>' {
                '›'
            } else if c == '`' {
                // See safe_label — backticks activate markdown-string mode
                // inside quoted contexts (quadrantChart item labels, xychart
                // title / x-axis / y-axis), with the same parse-abort hazard.
                '\''
            } else {
                c
            }
        })
        .collect();
    non_empty(mapped)
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
        // Mermaid rejects an empty `x-axis []` / `bar []`, and misrenders when
        // the label and bar counts disagree — so align them to the common
        // length and bail (empty string → caller omits the chart) when there's
        // nothing to plot. Defends the JSON re-render path; the builder already
        // returns None for empty bars.
        let n = self.x_axis_labels.len().min(self.bars.len());
        if n == 0 {
            return String::new();
        }

        // y-axis must be a real range; fall back to a sane window if degenerate.
        let (y_min, y_max) = if self.y_min.is_finite() && self.y_max.is_finite() && self.y_min < self.y_max {
            (self.y_min, self.y_max)
        } else {
            (-50.0, 100.0)
        };

        let mut out = String::new();
        // `theme_palette` is interpolated into a JSON-in-mermaid `init` directive;
        // a `}`/newline/quote in it can escape and inject arbitrary syntax.
        // `safe_palette` whitelists hex+comma so injection is impossible.
        out.push_str(&format!(
            "%%{{init: {{'theme':'base', 'themeVariables': {{'xyChart': {{'plotColorPalette': '{}'}}}}}}}}%%\n",
            safe_palette(&self.theme_palette)
        ));
        out.push_str("xychart-beta\n");
        out.push_str(&format!("    title \"{}\"\n", safe_quoted(&self.title)));
        let labels = self.x_axis_labels[..n]
            .iter()
            .map(|l| format!("\"{}\"", safe_quoted(l)))
            .collect::<Vec<_>>()
            .join(", ");
        out.push_str(&format!("    x-axis [{labels}]\n"));
        out.push_str(&format!(
            "    y-axis \"{}\" {} --> {}\n",
            safe_quoted(&self.y_axis_label),
            y_min,
            y_max
        ));
        let values = self.bars[..n]
            .iter()
            .map(|v| {
                let clamped = if v.is_finite() { v.clamp(y_min, y_max) } else { 0.0 };
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
        assert!(s.contains("a[\"Old\"]"));
        assert!(s.contains("c[\"New\"]"));
        assert!(s.contains("a --> b"));
        assert!(s.contains("b -.->|\"evolves\"|c"));
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
        // x=NaN → 0.00 (sane fallback); y=2.0 → 0.99 (clamped to the safe upper
        // bound — mermaid v11 rejects exactly 1.00, see QUADRANT_UNIT_MAX).
        assert!(s.contains("\"Bad NaN\": [0.00, 0.99]"));
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
        // `<`/`>` → guillemets so synthetic names render literally and
        // never reach Mermaid's HTML-tag parser. The originals must be gone.
        let g = safe_label("useTheme.<lambda@21>");
        assert_eq!(g, "useTheme.‹lambda@21›");
        assert!(!g.contains('<') && !g.contains('>'));
        assert!(!safe_quoted("(<module>, x)").contains('<'));
    }

    #[test]
    fn render_node_quotes_label_and_neutralizes_angle_brackets() {
        let n = FlowNode {
            id: "n0".into(),
            label: "<module>".into(),
            shape: NodeShape::Rect,
            class: None,
        };
        // Quoted + guillemets — no raw `<`/`>` that could abort the parse
        // or be eaten as an HTML tag.
        assert_eq!(render_node(&n), "n0[\"‹module›\"]");
    }

    // ── Offline guardrail against the whole adversarial corpus ──────────
    //
    // This runs with plain `cargo test` (no node/mermaid needed). It asserts
    // the *structural invariants* that make a node label safe for mermaid;
    // the heavier `tests/mermaid_validate.rs` integration test confirms the
    // same corpus against the REAL mermaid parser when node is available.
    // Single source of truth for the corpus is the JSON fixture, shared with
    // the integration test.
    const ADVERSARIAL_LABELS: &str =
        include_str!("../../tests/fixtures/mermaid_adversarial_labels.json");

    /// A rendered node-declaration line is mermaid-safe iff its label is
    /// double-quoted, carries no raw `<`/`>` (HTML-tag hazard), and contains
    /// exactly the two wrapping quotes plus no control chars.
    fn node_line_is_safe(line: &str) -> bool {
        line.contains("[\"")
            && line.contains("\"]")
            && !line.contains('<')
            && !line.contains('>')
            && line.matches('"').count() == 2
            && !line.chars().any(|c| c.is_control())
    }

    #[test]
    fn adversarial_labels_render_to_safe_nodes() {
        let labels: Vec<String> = serde_json::from_str(ADVERSARIAL_LABELS).unwrap();
        // A pathologically long label must be handled too.
        let mut all = labels.clone();
        all.push("x".repeat(600));

        for label in &all {
            let n = FlowNode {
                id: "n0".into(),
                label: label.clone(),
                shape: NodeShape::Rect,
                class: None,
            };
            let line = render_node(&n);
            assert!(
                node_line_is_safe(&line),
                "unsafe node line for label {label:?}: {line:?}"
            );
        }
    }

    #[test]
    fn invariant_predicate_rejects_the_original_bug() {
        // The exact shape that produced the user's `got 'LINK_ID'` error —
        // proves `node_line_is_safe` has teeth (would fail the test above).
        assert!(!node_line_is_safe("a_n2[useTheme.<lambda@21>]"));
        // …and accepts the fixed shape.
        assert!(node_line_is_safe("a_n2[\"useTheme.‹lambda@21›\"]"));
    }

    #[test]
    fn full_flowchart_of_adversarial_labels_has_no_raw_angle_open() {
        // `<` never appears in valid flowchart syntax (arrows use `>` only),
        // so a single raw `<` anywhere in a full render is a definite break.
        let labels: Vec<String> = serde_json::from_str(ADVERSARIAL_LABELS).unwrap();
        let nodes: Vec<FlowNode> = labels
            .iter()
            .enumerate()
            .map(|(i, l)| FlowNode {
                id: format!("n{i}"),
                label: l.clone(),
                shape: NodeShape::Rect,
                class: None,
            })
            .collect();
        let fc = Flowchart {
            direction: FlowDirection::TB,
            title: Some("adversarial <corpus>".into()),
            subgraphs: vec![],
            nodes,
            edges: vec![],
            class_defs: vec![],
        };
        let rendered = fc.render();
        assert!(!rendered.contains('<'), "raw '<' in render:\n{rendered}");
    }

    // ── New escapers / structural guards ─────────────────────────────────────

    #[test]
    fn safe_id_neutralizes_reserved_words_and_bad_chars() {
        // Reserved keywords → suffixed so the parse can't end early.
        assert_eq!(safe_id("end"), "end_");
        assert_eq!(safe_id("End"), "End_"); // case-insensitive match
        assert_eq!(safe_id("subgraph"), "subgraph_");
        assert_eq!(safe_id("class"), "class_");
        // Non-`[A-Za-z0-9_]` → underscore.
        assert_eq!(safe_id("a-b.c"), "a_b_c");
        assert_eq!(safe_id("foo bar"), "foo_bar");
        // Digit-leading → `n` prefix.
        assert_eq!(safe_id("0bad"), "n0bad");
        // Empty → single `_`, never empty.
        assert_eq!(safe_id(""), "_");
        // Synthetic builder ids pass through unchanged.
        for id in ["n0", "a_n12", "ds_0", "before_note", "BEFORE", "User"] {
            assert_eq!(safe_id(id), id, "synthetic id changed: {id}");
        }
    }

    #[test]
    fn safe_edge_label_replaces_pipe() {
        // `|` would close the edge-label delimiter early — must be replaced.
        assert_eq!(safe_edge_label("a|b|c"), "a/b/c");
        assert_eq!(safe_edge_label(""), LABEL_PLACEHOLDER);
        assert_eq!(safe_edge_label("evolves to"), "evolves to");
    }

    #[test]
    fn safe_label_and_safe_quoted_substitute_a_placeholder_for_blank_input() {
        assert_eq!(safe_label(""), LABEL_PLACEHOLDER);
        assert_eq!(safe_label("   "), LABEL_PLACEHOLDER);
        assert_eq!(safe_label("()"), LABEL_PLACEHOLDER); // all-stripped → blank → placeholder
        assert_eq!(safe_quoted(""), LABEL_PLACEHOLDER);
        // A label that contains real content survives unchanged.
        assert_eq!(safe_label("ok"), "ok");
        assert_eq!(safe_quoted("ok"), "ok");
    }

    #[test]
    fn render_node_protects_reserved_id_and_empty_label() {
        let n = FlowNode { id: "end".into(), label: "".into(), shape: NodeShape::Rect, class: None };
        // Reserved id suffixed, empty label → placeholder.
        assert_eq!(render_node(&n), "end_[\"·\"]");
    }

    #[test]
    fn flowchart_render_uses_safe_id_consistently_for_decl_edges_and_classes() {
        let fc = Flowchart {
            direction: FlowDirection::TB,
            title: None,
            subgraphs: vec![],
            nodes: vec![
                FlowNode { id: "end".into(), label: "A".into(), shape: NodeShape::Rect, class: Some("c".into()) },
                FlowNode { id: "0x".into(), label: "B".into(), shape: NodeShape::Rect, class: None },
            ],
            edges: vec![FlowEdge { from: "end".into(), to: "0x".into(), label: Some("a|b".into()), style: EdgeStyle::Solid }],
            class_defs: vec![],
        };
        let s = fc.render();
        // Declarations use safe_id …
        assert!(s.contains("    end_[\"A\"]"), "decl uses safe_id (end → end_):\n{s}");
        assert!(s.contains("    n0x[\"B\"]"), "digit-leading id prefixed:\n{s}");
        // … and edges + class lines use the SAME safe_id so refs stay matched.
        // Edge labels are now QUOTED (`|"…"|`) so an `@` or other operator
        // inside can't tokenize as LINK_ID.
        assert!(s.contains("    end_ -->|\"a/b\"|n0x"), "edge ids/label use safe_id + pipe replaced + quoted:\n{s}");
        assert!(s.contains("    class end_ c"), "class assignment uses safe_id:\n{s}");
    }

    #[test]
    fn safe_label_caps_pathological_lengths_with_ellipsis_and_no_codepoint_split() {
        // 600-char ASCII → truncated to LABEL_MAX_CHARS with a trailing ellipsis.
        let huge = "x".repeat(600);
        let out = safe_label(&huge);
        assert_eq!(out.chars().count(), LABEL_MAX_CHARS, "char-count cap not honoured");
        assert!(out.ends_with('…'), "missing ellipsis: {out:?}");
        // Multi-byte glyphs (emoji) must NEVER be split mid-codepoint.
        let emoji_long: String = std::iter::repeat("🚀").take(LABEL_MAX_CHARS + 50).collect();
        let truncated = safe_label(&emoji_long);
        assert_eq!(truncated.chars().count(), LABEL_MAX_CHARS);
        assert!(truncated.chars().filter(|c| *c == '🚀').count() >= LABEL_MAX_CHARS - 1);
        // Short labels pass through unchanged.
        assert_eq!(safe_label("short"), "short");
    }

    #[test]
    fn flowchart_classdef_and_class_assignment_use_safe_id() {
        // A `classDef end fill:…` line aborts the parse because `end` is a
        // mermaid keyword. The renderer must `safe_id` both the classDef name
        // AND the class name in the assignment so the same identifier is used
        // on both sides of the reference.
        let fc = Flowchart {
            direction: FlowDirection::TB,
            title: None,
            subgraphs: vec![],
            nodes: vec![FlowNode {
                id: "ok".into(),
                label: "x".into(),
                shape: NodeShape::Rect,
                class: Some("end".into()),
            }],
            edges: vec![],
            class_defs: vec![ClassDef {
                name: "end".into(),
                fill: "#fff".into(),
                stroke: "#000".into(),
                color: "#000".into(),
                stroke_width: None,
                stroke_dasharray: None,
            }],
        };
        let s = fc.render();
        assert!(s.contains("classDef end_ fill"), "classDef name not sanitized:\n{s}");
        assert!(s.contains("class ok end_"), "class assignment name not sanitized:\n{s}");
        // The reserved bare token must not survive anywhere except inside the
        // sanitized `end_` form.
        for line in s.lines() {
            let trimmed = line.trim();
            assert!(
                !(trimmed.starts_with("classDef end ") || trimmed == "class ok end"),
                "raw reserved 'end' as a class identifier leaked:\n{s}"
            );
        }
    }

    #[test]
    fn classdef_fields_strip_parens_commas_and_newlines() {
        // Empirically: mermaid's classDef parser FAILS on `(` / `)` (so a
        // `rgb(0,0,0)` color aborts the parse), and a comma injects an extra
        // key=value (silent style change). Newlines would terminate the line
        // and could inject below. `safe_class_value` strips all of those.
        assert_eq!(safe_class_value("rgb(0,0,0)"), "rgb000");
        assert_eq!(safe_class_value("#fff\nbad"), "#fffbad");
        assert_eq!(safe_class_value("#22c55e"), "#22c55e");
        assert_eq!(safe_class_value("transparent"), "transparent");
        assert_eq!(safe_class_value(""), "");
        // End-to-end through the render: a hostile fill value gets sanitized in
        // the emitted classDef line so the parser never sees `(`/`)`.
        let fc = Flowchart {
            direction: FlowDirection::TB,
            title: None,
            subgraphs: vec![],
            nodes: vec![FlowNode { id: "a".into(), label: "x".into(), shape: NodeShape::Rect, class: Some("k".into()) }],
            edges: vec![],
            class_defs: vec![ClassDef {
                name: "k".into(),
                fill: "rgb(0, 0, 0)".into(),     // ← hostile (parens break parse)
                stroke: "#fff\nbad,evil".into(), // ← hostile (newline + comma)
                color: "#000".into(),
                stroke_width: None,
                stroke_dasharray: None,
            }],
        };
        let s = fc.render();
        assert!(!s.contains("rgb(0"), "raw `(` leaked into classDef line:\n{s}");
        assert!(!s.contains("bad,evil"), "injected comma key leaked:\n{s}");
        // The classDef line is exactly one line — newline was stripped.
        let classdef_lines: Vec<&str> = s.lines().filter(|l| l.contains("classDef k")).collect();
        assert_eq!(classdef_lines.len(), 1, "classDef must span exactly one line, got: {classdef_lines:?}");
    }

    #[test]
    fn xychart_theme_palette_resists_directive_injection() {
        // `theme_palette` is interpolated into a `%%{init: { … }}%%` directive;
        // a tampered value containing `}`, newline, or quote could break out
        // and inject arbitrary mermaid. `safe_palette` whitelists the legitimate
        // alphabet (hex digits, `#`, comma, space) and falls back to the default
        // otherwise. Reachable through the JSON re-render path even though
        // builders only emit the safe constant.
        let cases = [
            // Injection attempts → all fall back to DEFAULT_XYCHART_PALETTE.
            ("hostile-close-brace", "#22c55e'}}}}%%\nflowchart TD\nbad"),
            ("hostile-newline", "#22c55e\nbad"),
            ("hostile-quote", "#22c55e','#ef4444"),
            ("hostile-empty", ""),
            // Legit palettes survive verbatim.
            ("legit-default", "#22c55e,#ef4444"),
            ("legit-with-spaces", "#22c55e, #ef4444, #58a6ff"),
        ];
        for (label, palette) in &cases {
            let xy = XyChart {
                title: "t".into(),
                theme_palette: (*palette).into(),
                x_axis_labels: vec!["a".into()],
                y_axis_label: "y".into(),
                y_min: 0.0,
                y_max: 1.0,
                bars: vec![0.5],
            };
            let out = xy.render();
            // The render NEVER contains a raw `}` outside the `init` block we control.
            // We can spot-check by counting `}}}}%%` (exactly one — the legit close).
            let bad_closes = out.matches("}}}}%%").count();
            assert_eq!(bad_closes, 1, "[{label}] palette={palette:?} produced extra `}}}}%%` close:\n{out}");
            // And no `flowchart TD` snuck in (no other diagram should follow init).
            assert!(!out.contains("flowchart TD"), "[{label}] palette={palette:?} leaked a second diagram:\n{out}");
            if label.starts_with("hostile") {
                // Hostile inputs must fall back to the safe default palette.
                assert!(out.contains(DEFAULT_XYCHART_PALETTE), "[{label}] no fallback in render:\n{out}");
            }
        }
    }

    #[test]
    fn escapers_are_idempotent_on_their_own_output() {
        // Property: `f(f(x)) == f(x)` for every sanitizer. This matters because
        // the same string can flow through the renderer multiple times (typed
        // struct → JSON → typed struct → re-render); a non-idempotent escaper
        // would drift the rendering between passes.
        let probes = [
            "",
            " ",
            "·",
            "()",
            "<module>",
            "useTheme.<lambda@21>",
            "a|b|c",
            "back`tick`label",
            "deeply: nested - 你好 🚀",
            "end",
            "0abc",
            "a-b_c.d",
            &"x".repeat(LABEL_MAX_CHARS + 50),
        ];
        for p in &probes {
            assert_eq!(safe_label(&safe_label(p)), safe_label(p), "safe_label not idempotent for {p:?}");
            assert_eq!(safe_quoted(&safe_quoted(p)), safe_quoted(p), "safe_quoted not idempotent for {p:?}");
            assert_eq!(safe_edge_label(&safe_edge_label(p)), safe_edge_label(p), "safe_edge_label not idempotent for {p:?}");
            assert_eq!(safe_id(&safe_id(p)), safe_id(p), "safe_id not idempotent for {p:?}");
        }
    }

    #[test]
    fn edge_labels_are_quoted_so_at_signs_dont_tokenize_as_link_id() {
        // Cousin of the original `useTheme.<lambda@21>` node-label break: an
        // unquoted edge label containing `@` is tokenized as a LINK_ID by
        // mermaid v11 and aborts the parse. Edge labels are now wrapped in
        // `|"…"|` so `@` (and any other operator) is treated as literal text.
        let fc = Flowchart {
            direction: FlowDirection::TB,
            title: None,
            subgraphs: vec![],
            nodes: vec![
                FlowNode { id: "a".into(), label: "A".into(), shape: NodeShape::Rect, class: None },
                FlowNode { id: "b".into(), label: "B".into(), shape: NodeShape::Rect, class: None },
            ],
            edges: vec![FlowEdge {
                from: "a".into(),
                to: "b".into(),
                label: Some("useTheme.<lambda@21>".into()),
                style: EdgeStyle::Solid,
            }],
            class_defs: vec![],
        };
        let s = fc.render();
        // Quoted, with `<>` mapped to guillemets (via safe_label) — `@` survives
        // because the quoting blocks the LINK_ID tokenization.
        assert!(
            s.contains("|\"useTheme.‹lambda@21›\"|"),
            "edge label not quoted-safely (would tokenize @ as LINK_ID):\n{s}"
        );
    }

    #[test]
    fn quadrant_clamps_below_the_open_upper_boundary_real_world_repro() {
        // Real production bug: a risk with severity = 1.00 aborted mermaid's
        // quadrantChart parse (the range is `[0.0, 1.0)`, not `[0.0, 1.0]`).
        // Plus the `{:.2}` formatter rounds 0.995..=1.0 to "1.00", which also
        // breaks. `sanitize_unit` clamps to QUADRANT_UNIT_MAX = 0.99 so the
        // formatted output is safely in-range.
        let q = QuadrantChart {
            title: "T".into(),
            x_axis_low: "Lo".into(), x_axis_high: "Hi".into(),
            y_axis_low: "Lo".into(), y_axis_high: "Hi".into(),
            quadrant_1: "A".into(), quadrant_2: "B".into(),
            quadrant_3: "C".into(), quadrant_4: "D".into(),
            items: vec![
                QuadrantItem { label: "at upper".into(), x: 1.0, y: 1.0 },
                QuadrantItem { label: "above".into(), x: 5.0, y: 2.0 },
                QuadrantItem { label: "just under".into(), x: 0.994, y: 0.996 },
            ],
        };
        let s = q.render();
        assert!(s.contains("\"at upper\": [0.99, 0.99]"), "1.0 must clamp DOWN to 0.99:\n{s}");
        assert!(s.contains("\"above\": [0.99, 0.99]"), "out-of-range must clamp DOWN to 0.99:\n{s}");
        // Critically: NO line in the render may contain " 1.00]" or "1.00," —
        // those are the formatted-output shapes mermaid v11 rejects.
        assert!(!s.contains("1.00]"), "rounded-up `1.00` boundary leaked into render:\n{s}");
        assert!(!s.contains("1.00,"), "rounded-up `1.00` boundary leaked into render:\n{s}");
    }

    #[test]
    fn xychart_empty_returns_empty_and_mismatched_truncates() {
        // Empty → empty string (caller omits the chart).
        let empty = XyChart {
            title: "t".into(),
            theme_palette: colors::XYCHART_PALETTE.into(),
            x_axis_labels: vec![],
            y_axis_label: "y".into(),
            y_min: 0.0,
            y_max: 1.0,
            bars: vec![],
        };
        assert_eq!(empty.render(), "");

        // Mismatched → both arrays clamped to min length; empty label → placeholder.
        let mix = XyChart {
            title: "t".into(),
            theme_palette: colors::XYCHART_PALETTE.into(),
            x_axis_labels: vec!["".into(), "b".into(), "c".into()],
            y_axis_label: "y".into(),
            y_min: 0.0,
            y_max: 10.0,
            bars: vec![1.0, 2.0],
        };
        let m = mix.render();
        assert!(m.contains(&format!("x-axis [\"{LABEL_PLACEHOLDER}\", \"b\"]")), "labels clamped + placeholder:\n{m}");
        assert!(m.contains("bar [1.0, 2.0]"), "bars present:\n{m}");
        assert!(!m.contains("\"c\""), "extra label was truncated:\n{m}");

        // Degenerate y-axis → fallback window so mermaid doesn't choke.
        let degen = XyChart {
            title: "t".into(),
            theme_palette: colors::XYCHART_PALETTE.into(),
            x_axis_labels: vec!["x".into()],
            y_axis_label: "y".into(),
            y_min: f64::NAN,
            y_max: f64::NAN,
            bars: vec![5.0],
        };
        assert!(degen.render().contains("-50 --> 100"));
    }
}
