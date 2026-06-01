//! JVM ORM scaffolding — shared between JPA/Hibernate + Spring Data
//! + (future) jOOQ, MyBatis, Exposed, Ktorm.
//!
//! Mirror of `super::python::mod` / `super::ts::mod` but for
//! tree-sitter-java grammar: `method_invocation` instead of `call`,
//! `field_access` instead of `attribute`/`member_expression`,
//! `annotation` for `@Repository` / `@Entity`, `enhanced_for_statement`
//! for `for (T t : ts) { ... }`.

pub mod jpa;

use crate::orm::context::{
    Binding, BindingKind, CallChain, CallStep, ChainRoot, ClassDef, DecoratorSite, IterKind,
    IterationMarker, LoopRange, PyOrmContext, ScopeId, TsClientFacts, TsClientKind,
};
use tree_sitter::{Node, Tree};

/// One iterative DFS pass populates every collector for Java.
pub fn build_context<'a>(source: &'a str, tree: &'a Tree) -> PyOrmContext<'a> {
    let mut ctx = PyOrmContext {
        source,
        file: "<inline>",
        ..PyOrmContext::default()
    };
    super::walker::walk_tree(tree.root_node(), |node| match node.kind() {
        "import_declaration" => handle_import_node(node, source, &mut ctx),
        "class_declaration" | "interface_declaration" => {
            handle_class_def(node, source, &mut ctx)
        }
        "enhanced_for_statement" => handle_for_loop(node, source, &mut ctx),
        "marker_annotation" | "annotation" => handle_annotation(node, source, &mut ctx),
        "method_invocation" => {
            // Stream-API lambda side-effect: `list.stream().forEach(x -> …)`
            // — register the lambda body as a loop range so
            // `chain.in_loop` works inside stream pipelines.
            handle_stream_lambda(node, source, &mut ctx);
            if !is_inner_call_of_chain(node) {
                if let Some(chain) = reconstruct_chain(node, source, &ctx) {
                    ctx.chains.push(chain);
                }
            }
        }
        _ => {}
    });
    infer_bindings(source, &mut ctx);
    propagate_loop_bindings(&mut ctx);
    finalize_chain_roots(&mut ctx);
    ctx
}

fn handle_import_node(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    if let Ok(text) = node.utf8_text(source.as_bytes()) {
        let raw = text
            .trim()
            .trim_start_matches("import ")
            .trim_start_matches("static ")
            .trim_end_matches(';')
            .trim();
        if let Some((module, _name)) = raw.rsplit_once('.') {
            ctx.imports.modules.insert(raw.to_string(), Vec::new());
            ctx.imports
                .modules
                .insert(module.to_string(), Vec::new());
        } else {
            ctx.imports.modules.insert(raw.to_string(), Vec::new());
        }
    }
}

fn handle_class_def(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
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
    // Shape: for (Type name : iterable) { body }
    let var = node
        .child_by_field_name("name")
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let iter = node
        .child_by_field_name("value")
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let Some(body) = node.child_by_field_name("body") else {
        return;
    };
    // Fall back to the for_statement's end if tree-sitter collapses the
    // body block's range to a point (an observed quirk on certain inputs).
    // Mirrors the Python walker's `push_iteration_node` fallback.
    let body_byte = body.byte_range();
    let effective = if body_byte.start == body_byte.end {
        body_byte.start..node.end_byte()
    } else {
        body_byte
    };
    let line_range = body.start_position().row + 1..node.end_position().row + 1;
    ctx.for_loops.push(LoopRange {
        iterable_var: iter,
        loop_var: var.clone(),
        body_range: effective.clone(),
        line_range,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind: IterKind::ForLoop,
        loop_var: var,
        body_range: effective,
    });
}

fn handle_stream_lambda(call_node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let Some(name) = call_node.child_by_field_name("name") else {
        return;
    };
    let Ok(method) = name.utf8_text(source.as_bytes()) else {
        return;
    };
    if !matches!(method, "forEach" | "map" | "filter" | "flatMap" | "peek") {
        return;
    }
    extract_lambda_loop_body(call_node, source, ctx);
}

fn extract_lambda_loop_body(call_node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let Some(args) = call_node.child_by_field_name("arguments") else {
        return;
    };
    let mut cur = args.walk();
    if !cur.goto_first_child() {
        return;
    }
    loop {
        let arg = cur.node();
        if arg.kind() == "lambda_expression" {
            // params: single identifier or `(a, b)`
            let param_var = arg
                .child_by_field_name("parameters")
                .and_then(|p| {
                    if p.kind() == "identifier" {
                        Some(p)
                    } else {
                        p.named_child(0)
                    }
                })
                .and_then(|p| p.utf8_text(source.as_bytes()).ok())
                .unwrap_or("")
                .trim_matches(|c: char| c == '(' || c == ')')
                .to_string();
            let body = arg.child_by_field_name("body");
            if let Some(body) = body {
                let iter_var = call_node
                    .child_by_field_name("object")
                    .and_then(|o| o.utf8_text(source.as_bytes()).ok())
                    .unwrap_or("")
                    .to_string();
                ctx.for_loops.push(LoopRange {
                    iterable_var: iter_var,
                    loop_var: param_var.clone(),
                    body_range: body.byte_range(),
                    line_range: body.start_position().row + 1..body.end_position().row + 1,
                });
                ctx.iteration_markers.push(IterationMarker {
                    kind: IterKind::ForLoop,
                    loop_var: param_var,
                    body_range: body.byte_range(),
                });
            }
            break;
        }
        if !cur.goto_next_sibling() {
            break;
        }
    }
}

fn handle_annotation(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let text = node
        .utf8_text(source.as_bytes())
        .unwrap_or("")
        .to_string();
    // Target = parent's next named symbol declaration
    let target = node
        .parent()
        .and_then(|p| p.parent())
        .and_then(|gp| {
            if matches!(
                gp.kind(),
                "class_declaration"
                    | "method_declaration"
                    | "field_declaration"
                    | "interface_declaration"
            ) {
                gp.child_by_field_name("name")
            } else {
                None
            }
        })
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    ctx.decorators.push(DecoratorSite {
        decorator_expr: text,
        function_name: target,
        line: node.start_position().row + 1,
        byte_range: node.byte_range(),
    });
}

fn is_inner_call_of_chain(node: Node) -> bool {
    // Java: a method_invocation whose parent is another method_invocation
    // and this one is the parent's `object` field.
    let Some(parent) = node.parent() else { return false };
    if parent.kind() != "method_invocation" {
        return false;
    }
    parent
        .child_by_field_name("object")
        .map(|o| o.id() == node.id())
        .unwrap_or(false)
}

// (collect_chains removed — chain reconstruction is dispatched from
// `build_context`'s iterative walker for `method_invocation` nodes.)

fn reconstruct_chain(outer: Node, source: &str, ctx: &PyOrmContext<'_>) -> Option<CallChain> {
    let mut steps: Vec<CallStep> = Vec::new();
    let mut current = outer;
    loop {
        match current.kind() {
            "method_invocation" => {
                let name = current
                    .child_by_field_name("name")?
                    .utf8_text(source.as_bytes())
                    .ok()?
                    .to_string();
                let args_text = current
                    .child_by_field_name("arguments")
                    .and_then(|a| a.utf8_text(source.as_bytes()).ok())
                    .map(|s| split_top_level_args(s))
                    .unwrap_or_default();
                steps.push(CallStep {
                    method: name,
                    args_text,
                    line: current.start_position().row + 1,
                    byte_range: current.byte_range(),
                });
                if let Some(obj) = current.child_by_field_name("object") {
                    current = obj;
                } else {
                    // Bare call like `methodName(args)` — no object.
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
            "field_access" => {
                let name = current
                    .child_by_field_name("field")?
                    .utf8_text(source.as_bytes())
                    .ok()?
                    .to_string();
                steps.push(CallStep {
                    method: name,
                    args_text: Vec::new(),
                    line: current.start_position().row + 1,
                    byte_range: current.byte_range(),
                });
                let obj = current.child_by_field_name("object")?;
                current = obj;
            }
            "identifier" | "this" => {
                let text = current.utf8_text(source.as_bytes()).ok()?.to_string();
                steps.reverse();
                let in_loop = ctx.is_in_loop(outer.start_byte());
                return Some(CallChain {
                    steps,
                    root: classify_root(&text, ctx),
                    byte_range: outer.byte_range(),
                    in_loop,
                });
            }
            "object_creation_expression" => {
                // `new Foo()` — treat as identifier root.
                let class_name = current
                    .child_by_field_name("type")
                    .and_then(|t| t.utf8_text(source.as_bytes()).ok())
                    .unwrap_or("")
                    .to_string();
                steps.reverse();
                let in_loop = ctx.is_in_loop(outer.start_byte());
                return Some(CallChain {
                    steps,
                    root: ChainRoot::Identifier(format!("new {class_name}")),
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

fn classify_root(text: &str, _ctx: &PyOrmContext<'_>) -> ChainRoot {
    ChainRoot::Identifier(text.trim().to_string())
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
            (None, '"') | (None, '\'') => {
                in_string = Some(ch);
                cur.push(ch);
            }
            (None, '(') | (None, '[') | (None, '{') | (None, '<') => {
                depth += 1;
                cur.push(ch);
            }
            (None, ')') | (None, ']') | (None, '}') | (None, '>') => {
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

fn infer_bindings(source: &str, ctx: &mut PyOrmContext<'_>) {
    // Java: `Type name = expr;` — local var declarations.
    // We approximate by looking at the source prefix of each chain.
    let chain_summaries: Vec<(std::ops::Range<usize>, Option<BindingKind>, String)> = ctx
        .chains
        .iter()
        .filter_map(|chain| {
            let stmt_start = previous_stmt_start(source, chain.byte_range.start);
            let pre = &source[stmt_start..chain.byte_range.start];
            let lhs = extract_lhs_var(pre)?;
            let kind = classify_chain(chain);
            Some((chain.byte_range.clone(), kind, lhs))
        })
        .collect();
    for (byte_range, kind, lhs) in chain_summaries {
        if let Some(kind) = kind {
            ctx.bindings
                .entry(lhs)
                .or_insert_with(Vec::new)
                .push(Binding {
                    kind,
                    byte_range,
                    scope: ScopeId(0),
                });
        }
    }
}

fn extract_lhs_var(prefix: &str) -> Option<String> {
    let stripped = prefix.trim_end();
    let stripped = stripped.strip_suffix('=')?.trim_end();
    // Trim a type-name token before the identifier: `List<User> users = ...`
    let last_token: &str = stripped.split_whitespace().last()?;
    let ident: String = last_token
        .chars()
        .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '$')
        .collect();
    if ident.is_empty() {
        None
    } else {
        Some(ident)
    }
}

fn previous_stmt_start(source: &str, pos: usize) -> usize {
    let prefix = &source[..pos];
    let semi = prefix.rfind(';').map(|i| i + 1);
    let nl = prefix.rfind('\n').map(|i| i + 1);
    let brace = prefix.rfind('{').map(|i| i + 1);
    [semi, nl, brace]
        .iter()
        .filter_map(|x| *x)
        .max()
        .unwrap_or(0)
}

fn classify_chain(_chain: &CallChain) -> Option<BindingKind> {
    // JPA chains are typically `repo.find...()` or
    // `entityManager.createQuery(...).getResultList()`. Detection is
    // primarily by root-name heuristic (in jpa.rs); we don't bind a
    // generic kind here.
    None
}

fn propagate_loop_bindings(ctx: &mut PyOrmContext<'_>) {
    // Java for-each: `for (User u : users)`. Only mark `u` as a
    // tracked instance if `users` is itself a known TsClient binding.
    // The earlier blanket `None => Some(...)` over-bound EVERY loop
    // var as TsClient — including the trivial `for (int i : ints)` —
    // which could cause false positives in rules that key on
    // loop-var bindings.
    let pairs: Vec<(String, String, std::ops::Range<usize>)> = ctx
        .for_loops
        .iter()
        .map(|l| (l.loop_var.clone(), l.iterable_var.clone(), l.body_range.clone()))
        .collect();
    for (loop_var, iter_var, body_range) in pairs {
        let inner = iter_var.trim();
        let is_tracked = ctx
            .binding_at(inner, body_range.start)
            .map(|b| matches!(b.kind, BindingKind::TsClient(_)))
            .unwrap_or(false);
        if !is_tracked {
            continue;
        }
        ctx.bindings
            .entry(loop_var)
            .or_insert_with(Vec::new)
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

#[cfg(test)]
mod tests {
    use super::*;
    use tree_sitter::Parser;

    fn parse(src: &str) -> Tree {
        let mut p = Parser::new();
        p.set_language(&crate::languages::java::language()).unwrap();
        p.parse(src, None).unwrap()
    }

    #[test]
    fn reconstructs_jpa_repo_chain() {
        let src = "class X { void f() { userRepo.findById(1L); } }\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(!ctx.chains.is_empty());
        let methods: Vec<&str> = ctx.chains[0]
            .steps
            .iter()
            .map(|s| s.method.as_str())
            .collect();
        assert_eq!(methods, vec!["findById"]);
        match &ctx.chains[0].root {
            ChainRoot::Identifier(t) | ChainRoot::Binding(t) => {
                assert_eq!(t, "userRepo");
            }
            r => panic!("unexpected root {r:?}"),
        }
    }

    #[test]
    fn enhanced_for_loop_is_detected() {
        let src = "class X { void f() { for (User u : users) { u.getId(); } } }\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert_eq!(ctx.for_loops.len(), 1);
        assert_eq!(ctx.for_loops[0].loop_var, "u");
    }

    #[test]
    fn jpa_repository_annotation_detected() {
        let src = "@Repository\ninterface UserRepository extends JpaRepository<User, Long> {}\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(ctx.decorators.iter().any(|d| d.decorator_expr.contains("Repository")));
    }
}
