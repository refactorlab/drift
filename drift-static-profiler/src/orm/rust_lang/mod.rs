//! Rust ORM scaffolding — SQLx, Diesel, SeaORM.
//!
//! Compile-time ORMs (SQLx, Diesel macro-driven) catch most SQL errors
//! at compile. Phase 4 rules focus on the residue: `query!(...)` with
//! `format!(...)`, `sqlx::query(...)` with raw `&str` concat, and
//! Diesel's `boxed()` chained on every iteration.

pub mod sqlx;

use crate::orm::context::{
    CallChain, CallStep, ChainRoot, ClassDef, IterKind, IterationMarker, LoopRange,
    PyOrmContext,
};
use tree_sitter::{Node, Tree};

/// One iterative DFS pass populates every collector for Rust.
pub fn build_context<'a>(source: &'a str, tree: &'a Tree) -> PyOrmContext<'a> {
    let mut ctx = PyOrmContext {
        file: "<inline>",
        ..PyOrmContext::default()
    };
    super::walker::walk_tree(tree.root_node(), |node| match node.kind() {
        "use_declaration" => handle_use(node, source, &mut ctx),
        "struct_item" | "enum_item" => handle_struct(node, source, &mut ctx),
        "for_expression" => handle_for_loop(node, source, &mut ctx),
        "call_expression" => {
            if !is_inner_call_of_chain(node) {
                if let Some(chain) = reconstruct_chain(node, source, &ctx) {
                    ctx.chains.push(chain);
                }
            }
        }
        // Capture `sqlx::query!(...)` style macros — they aren't
        // call_expressions in tree-sitter-rust.
        "macro_invocation" => {
            if let Some(chain) = reconstruct_macro_chain(node, source, &ctx) {
                ctx.chains.push(chain);
            }
        }
        _ => {}
    });
    ctx
}

fn handle_use(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    if let Ok(text) = node.utf8_text(source.as_bytes()) {
        let raw = text
            .trim()
            .trim_start_matches("use ")
            .trim_end_matches(';')
            .trim();
        ctx.imports.modules.insert(raw.to_string(), Vec::new());
    }
}

fn handle_struct(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let name = node
        .child_by_field_name("name")
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    ctx.class_defs.push(ClassDef {
        name,
        base: None,
        byte_range: node.byte_range(),
        line: node.start_position().row + 1,
    });
}

fn handle_for_loop(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let var = node
        .child_by_field_name("pattern")
        .and_then(|p| p.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let iter = node
        .child_by_field_name("value")
        .and_then(|r| r.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let Some(body) = node.child_by_field_name("body") else { return };
    ctx.for_loops.push(LoopRange {
        iterable_var: iter,
        loop_var: var.clone(),
        body_range: body.byte_range(),
        line_range: body.start_position().row + 1..body.end_position().row + 1,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind: IterKind::ForLoop,
        loop_var: var,
        body_range: body.byte_range(),
    });
}

fn is_inner_call_of_chain(node: Node) -> bool {
    let Some(parent) = node.parent() else { return false };
    if parent.kind() != "field_expression" {
        return false;
    }
    let Some(grand) = parent.parent() else { return false };
    grand.kind() == "call_expression"
}

fn reconstruct_chain(outer: Node, source: &str, ctx: &PyOrmContext<'_>) -> Option<CallChain> {
    let mut steps: Vec<CallStep> = Vec::new();
    let mut current = outer;
    loop {
        match current.kind() {
            "call_expression" => {
                let function = current.child_by_field_name("function")?;
                let args_text = current
                    .child_by_field_name("arguments")
                    .and_then(|a| a.utf8_text(source.as_bytes()).ok())
                    .map(|s| split_top_level_args(s))
                    .unwrap_or_default();
                match function.kind() {
                    "identifier" => {
                        let name = function.utf8_text(source.as_bytes()).ok()?.to_string();
                        steps.push(CallStep {
                            method: name,
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        steps.reverse();
                        let in_loop = ctx.is_in_loop(outer.start_byte());
                        return Some(CallChain {
                            steps,
                            root: ChainRoot::Unknown,
                            byte_range: outer.byte_range(),
                            in_loop,
                        });
                    }
                    "field_expression" => {
                        let field = function.child_by_field_name("field")?;
                        let name = field.utf8_text(source.as_bytes()).ok()?.to_string();
                        steps.push(CallStep {
                            method: name,
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        let value = function.child_by_field_name("value")?;
                        current = value;
                    }
                    "scoped_identifier" => {
                        // `sqlx::query(...)` — emit single-step chain.
                        let text = function.utf8_text(source.as_bytes()).ok()?.to_string();
                        let name = text
                            .rsplit("::")
                            .next()
                            .unwrap_or(&text)
                            .to_string();
                        steps.push(CallStep {
                            method: name,
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        steps.reverse();
                        let in_loop = ctx.is_in_loop(outer.start_byte());
                        return Some(CallChain {
                            steps,
                            root: ChainRoot::Identifier(text),
                            byte_range: outer.byte_range(),
                            in_loop,
                        });
                    }
                    _ => return None,
                }
            }
            "field_expression" => {
                let field = current.child_by_field_name("field")?;
                let name = field.utf8_text(source.as_bytes()).ok()?.to_string();
                steps.push(CallStep {
                    method: name,
                    args_text: Vec::new(),
                    line: current.start_position().row + 1,
                    byte_range: current.byte_range(),
                });
                let value = current.child_by_field_name("value")?;
                current = value;
            }
            "identifier" | "self" => {
                let text = current.utf8_text(source.as_bytes()).ok()?.to_string();
                steps.reverse();
                let in_loop = ctx.is_in_loop(outer.start_byte());
                return Some(CallChain {
                    steps,
                    root: ChainRoot::Identifier(text),
                    byte_range: outer.byte_range(),
                    in_loop,
                });
            }
            _ => {
                steps.reverse();
                let in_loop = ctx.is_in_loop(outer.start_byte());
                return Some(CallChain {
                    steps,
                    root: ChainRoot::Unknown,
                    byte_range: outer.byte_range(),
                    in_loop,
                });
            }
        }
    }
}

fn reconstruct_macro_chain(
    node: Node,
    source: &str,
    ctx: &PyOrmContext<'_>,
) -> Option<CallChain> {
    let macro_name = node
        .child_by_field_name("macro")
        .and_then(|m| m.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let bare = macro_name
        .rsplit("::")
        .next()
        .unwrap_or(&macro_name)
        .to_string();
    if !matches!(
        bare.as_str(),
        "query" | "query_as" | "query_scalar" | "query_unchecked" | "query_file"
    ) {
        return None;
    }
    // Grab the token tree text for args.
    let args_text = node
        .named_child(node.named_child_count().saturating_sub(1))
        .and_then(|t| t.utf8_text(source.as_bytes()).ok())
        .map(|s| vec![s.to_string()])
        .unwrap_or_default();
    let step = CallStep {
        method: bare.clone(),
        args_text,
        line: node.start_position().row + 1,
        byte_range: node.byte_range(),
    };
    let in_loop = ctx.is_in_loop(node.start_byte());
    Some(CallChain {
        steps: vec![step],
        root: ChainRoot::Identifier(macro_name),
        byte_range: node.byte_range(),
        in_loop,
    })
}

fn split_top_level_args(args: &str) -> Vec<String> {
    let inner = args.trim();
    let inner = inner
        .strip_prefix('(')
        .and_then(|s| s.strip_suffix(')'))
        .unwrap_or(inner);
    let mut out: Vec<String> = Vec::new();
    let mut depth: i32 = 0;
    let mut cur = String::new();
    let mut in_string: Option<char> = None;
    for ch in inner.chars() {
        match (in_string, ch) {
            (Some(q), c) if c == q => {
                in_string = None;
                cur.push(c);
            }
            (None, '"') => {
                in_string = Some(ch);
                cur.push(ch);
            }
            (None, '(') | (None, '[') | (None, '{') => {
                depth += 1;
                cur.push(ch);
            }
            (None, ')') | (None, ']') | (None, '}') => {
                depth -= 1;
                cur.push(ch);
            }
            (None, ',') if depth == 0 => {
                if !cur.trim().is_empty() {
                    out.push(cur.trim().to_string());
                }
                cur.clear();
            }
            _ => cur.push(ch),
        }
    }
    if !cur.trim().is_empty() {
        out.push(cur.trim().to_string());
    }
    out
}
