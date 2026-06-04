//! Go ORM scaffolding — GORM, ent, bun, sqlc share most shapes.
//!
//! Phase 4 ships GORM coverage. The grammar nodes are
//! `call_expression`, `selector_expression`, `for_statement`.

pub mod gorm;

use crate::orm::context::{
    Binding, BindingKind, CallChain, CallStep, ChainRoot, ClassDef, IterKind, IterationMarker,
    LoopRange, PyOrmContext, ScopeId, TsClientFacts, TsClientKind,
};
use tree_sitter::{Node, Tree};

/// One iterative DFS pass populates every collector for Go.
pub fn build_context<'a>(source: &'a str, tree: &'a Tree) -> PyOrmContext<'a> {
    let mut ctx = PyOrmContext {
        source,
        file: "<inline>",
        ..PyOrmContext::default()
    };
    super::walker::walk_tree(tree.root_node(), |node| match node.kind() {
        "import_spec" => handle_import_node(node, source, &mut ctx),
        "type_spec" => handle_type_spec(node, source, &mut ctx),
        "for_statement" => handle_for_loop(node, source, &mut ctx),
        "call_expression"
            if !is_inner_call_of_chain(node) => {
                if let Some(chain) = reconstruct_chain(node, source, &ctx) {
                    ctx.chains.push(chain);
                }
            }
        _ => {}
    });
    propagate_loop_bindings(&mut ctx);
    finalize_chain_roots(&mut ctx);
    ctx
}

fn handle_import_node(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    if let Some(path) = node.child_by_field_name("path") {
        if let Ok(text) = path.utf8_text(source.as_bytes()) {
            let module = text.trim_matches('"').to_string();
            ctx.imports.modules.insert(module, Vec::new());
        }
    }
}

fn handle_type_spec(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
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
    // Go: `for _, x := range xs { ... }` is a for_statement whose
    // body is a block, with a `range_clause` immediate child.
    let body = node.child_by_field_name("body");
    let mut loop_var = String::new();
    let mut iter_var = String::new();
    let mut cur = node.walk();
    if cur.goto_first_child() {
        loop {
            let c = cur.node();
            if c.kind() == "range_clause" {
                let left = c
                    .child_by_field_name("left")
                    .and_then(|l| l.utf8_text(source.as_bytes()).ok())
                    .unwrap_or("");
                let right = c
                    .child_by_field_name("right")
                    .and_then(|r| r.utf8_text(source.as_bytes()).ok())
                    .unwrap_or("");
                iter_var = right.trim().to_string();
                loop_var = left.split(',').next_back().unwrap_or("").trim().to_string();
                break;
            }
            if !cur.goto_next_sibling() {
                break;
            }
        }
    }
    let Some(body) = body else { return };
    ctx.for_loops.push(LoopRange {
        iterable_var: iter_var,
        loop_var: loop_var.clone(),
        body_range: body.byte_range(),
        line_range: body.start_position().row + 1..body.end_position().row + 1,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind: IterKind::ForLoop,
        loop_var,
        body_range: body.byte_range(),
    });
}

fn is_inner_call_of_chain(node: Node) -> bool {
    let Some(parent) = node.parent() else { return false };
    if parent.kind() != "selector_expression" {
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
                    .map(split_top_level_args)
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
                    "selector_expression" => {
                        let field = function.child_by_field_name("field")?;
                        let name = field.utf8_text(source.as_bytes()).ok()?.to_string();
                        steps.push(CallStep {
                            method: name,
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        let operand = function.child_by_field_name("operand")?;
                        current = operand;
                    }
                    _ => return None,
                }
            }
            "selector_expression" => {
                let field = current.child_by_field_name("field")?;
                let name = field.utf8_text(source.as_bytes()).ok()?.to_string();
                steps.push(CallStep {
                    method: name,
                    args_text: Vec::new(),
                    line: current.start_position().row + 1,
                    byte_range: current.byte_range(),
                });
                let operand = current.child_by_field_name("operand")?;
                current = operand;
            }
            "identifier" => {
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
            (None, '"') | (None, '`') => {
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

fn propagate_loop_bindings(ctx: &mut PyOrmContext<'_>) {
    // Go GORM analysis uses `chain.in_loop` (byte-range membership)
    // rather than loop-var bindings — there's no "queryset" abstraction
    // in idiomatic Go (you iterate a slice of plain structs after
    // calling `db.Find(&users)`). Without a gate, indiscriminately
    // marking every loop var as TsClient would shadow real bindings.
    // Gate to: only mark loop vars whose iterable is itself a known
    // TsClient binding (rare, but supported).
    let pairs: Vec<(String, String, std::ops::Range<usize>)> = ctx
        .for_loops
        .iter()
        .map(|l| (l.loop_var.clone(), l.iterable_var.clone(), l.body_range.clone()))
        .collect();
    for (loop_var, iter_var, body_range) in pairs {
        if loop_var.is_empty() {
            continue;
        }
        let is_tracked = ctx
            .binding_at(iter_var.trim(), body_range.start)
            .map(|b| matches!(b.kind, BindingKind::TsClient(_)))
            .unwrap_or(false);
        if !is_tracked {
            continue;
        }
        ctx.bindings
            .entry(loop_var)
            .or_default()
            .push(Binding {
                kind: BindingKind::TsClient(TsClientFacts {
                    kind: TsClientKind::Generic,
                    model: None,
                }),
                byte_range: body_range,
                scope: ScopeId(1),
            });
    }
}

fn finalize_chain_roots(ctx: &mut PyOrmContext<'_>) {
    let names: std::collections::HashSet<String> = ctx.bindings.keys().cloned().collect();
    for chain in &mut ctx.chains {
        if let ChainRoot::Identifier(t) = &chain.root {
            let bare = t.trim().to_string();
            if names.contains(&bare) {
                chain.root = ChainRoot::Binding(bare);
            }
        }
    }
}
