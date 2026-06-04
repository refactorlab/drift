//! TypeScript / JavaScript ORM scaffolding — shared between Prisma,
//! Drizzle, TypeORM, Sequelize, Mongoose.
//!
//! Mirror of `super::python::mod` but for tree-sitter-typescript /
//! tree-sitter-javascript grammars: nodes are `call_expression`,
//! `member_expression`, `arrow_function`, `decorator`, `for_in_statement`,
//! `for_of_statement` instead of Python's `call` / `attribute` / etc.

pub mod drizzle;
pub mod mongoose;
pub mod prisma;
pub mod sequelize;
pub mod typeorm;

use crate::orm::context::{
    Binding, BindingKind, CallChain, CallStep, ChainRoot, ClassDef, DecoratorSite, IterKind,
    IterationMarker, LoopRange, PyOrmContext, ScopeId, TsClientFacts, TsClientKind,
};
use tree_sitter::{Node, Tree};

/// Build a `PyOrmContext` for a TypeScript / JavaScript source file.
///
/// **One iterative DFS pass** (via `walker::walk_tree`) drives every
/// per-node handler — same architectural choice as the Python walker.
/// No recursion, heap-bounded.
pub fn build_context<'a>(source: &'a str, tree: &'a Tree) -> PyOrmContext<'a> {
    let mut ctx = PyOrmContext {
        source,
        file: "<inline>",
        ..PyOrmContext::default()
    };
    super::walker::walk_tree(tree.root_node(), |node| match node.kind() {
        "import_statement" => handle_import_node(node, source, &mut ctx),
        "class_declaration" | "class" => handle_class_def(node, source, &mut ctx),
        "for_in_statement" | "for_of_statement" => handle_for_loop(node, source, &mut ctx),
        "decorator" => handle_decorator(node, source, &mut ctx),
        "call_expression" => {
            // Array-method callbacks (map/forEach/...) — register the
            // arrow-fn body as a loop range so `chain.in_loop` works
            // inside `.map(x => ...)`.
            handle_array_callback(node, source, &mut ctx);
            // Outermost call of a chain → reconstruct.
            if !is_inner_call_of_chain(node) {
                if let Some(chain) = reconstruct_chain(node, source, &ctx) {
                    ctx.chains.push(chain);
                }
            }
        }
        "new_expression" => {
            if let Some(chain) = reconstruct_new_chain(node, source, &ctx) {
                ctx.chains.push(chain);
            }
        }
        _ => {}
    });
    infer_bindings(source, &mut ctx);
    propagate_loop_bindings(&mut ctx);
    finalize_chain_roots(&mut ctx);
    ctx
}

// ─── Per-node handlers ──────────────────────────────────────────────────

fn handle_import_node(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let module = node
        .child_by_field_name("source")
        .and_then(|s| s.utf8_text(source.as_bytes()).ok())
        .map(|s| s.trim_matches('"').trim_matches('\'').to_string())
        .unwrap_or_default();
    let mut names = Vec::new();
    let mut cur = node.walk();
    if cur.goto_first_child() {
        loop {
            let n = cur.node();
            if n.kind() == "import_clause" {
                collect_imported_names(n, source, &mut names);
            }
            if !cur.goto_next_sibling() {
                break;
            }
        }
    }
    ctx.imports.modules.insert(module, names);
}

fn collect_imported_names(node: Node, source: &str, names: &mut Vec<String>) {
    let mut cur = node.walk();
    if cur.goto_first_child() {
        loop {
            let n = cur.node();
            match n.kind() {
                "identifier" => {
                    if let Ok(t) = n.utf8_text(source.as_bytes()) {
                        names.push(t.to_string());
                    }
                }
                "named_imports" | "namespace_import" => {
                    collect_imported_names(n, source, names);
                }
                "import_specifier" => {
                    if let Some(name) = n.child_by_field_name("name") {
                        if let Ok(t) = name.utf8_text(source.as_bytes()) {
                            names.push(t.to_string());
                        }
                    }
                }
                _ => {}
            }
            if !cur.goto_next_sibling() {
                break;
            }
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
    let var = node
        .child_by_field_name("left")
        .and_then(|l| l.utf8_text(source.as_bytes()).ok())
        .map(|s| {
            s.trim_start_matches("const ")
                .trim_start_matches("let ")
                .trim_start_matches("var ")
                .trim()
                .to_string()
        })
        .unwrap_or_default();
    let iter = node
        .child_by_field_name("right")
        .and_then(|r| r.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let Some(body) = node.child_by_field_name("body") else {
        return;
    };
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

fn handle_array_callback(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let Some(fn_node) = node.child_by_field_name("function") else {
        return;
    };
    if fn_node.kind() != "member_expression" {
        return;
    }
    let Some(prop) = fn_node.child_by_field_name("property") else {
        return;
    };
    let Ok(method) = prop.utf8_text(source.as_bytes()) else {
        return;
    };
    if !matches!(method, "map" | "forEach" | "filter" | "reduce" | "flatMap") {
        return;
    }
    extract_arrow_loop(node, source, method, ctx);
}

fn extract_arrow_loop(
    call_node: Node,
    source: &str,
    method: &str,
    ctx: &mut PyOrmContext<'_>,
) {
    let Some(args) = call_node.child_by_field_name("arguments") else {
        return;
    };
    let mut cur = args.walk();
    if !cur.goto_first_child() {
        return;
    }
    loop {
        let arg = cur.node();
        if arg.kind() == "arrow_function" || arg.kind() == "function_expression" {
            // Param 0 is the iteration var. Arrow functions in TS can
            // have a bare identifier (`u => ...`) or a formal_parameters
            // node (`(u) => ...` / `(u, i) => ...`). Handle both.
            let param_var = arg
                .child_by_field_name("parameter")
                .or_else(|| arg.child_by_field_name("parameters"))
                .and_then(|ps| match ps.kind() {
                    "identifier" => Some(ps),
                    _ => ps.named_child(0),
                })
                .and_then(|p| {
                    // formal_parameter / required_parameter may wrap an identifier
                    let inner = if matches!(
                        p.kind(),
                        "required_parameter" | "optional_parameter" | "formal_parameter"
                    ) {
                        p.child_by_field_name("pattern").unwrap_or(p)
                    } else {
                        p
                    };
                    inner.utf8_text(source.as_bytes()).ok()
                })
                .unwrap_or("")
                .to_string();
            let body = arg.child_by_field_name("body");
            if let Some(body) = body {
                let iter_var = call_node
                    .child_by_field_name("function")
                    .and_then(|f| f.child_by_field_name("object"))
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
            let _ = method;
            break;
        }
        if !cur.goto_next_sibling() {
            break;
        }
    }
}

fn handle_decorator(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let text = node
        .utf8_text(source.as_bytes())
        .unwrap_or("")
        .to_string();
    let target_name = node
        .next_sibling()
        .and_then(|s| match s.kind() {
            "method_definition" | "public_field_definition" => s.child_by_field_name("name"),
            "class_declaration" => s.child_by_field_name("name"),
            _ => None,
        })
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    ctx.decorators.push(DecoratorSite {
        decorator_expr: text,
        function_name: target_name,
        line: node.start_position().row + 1,
        byte_range: node.byte_range(),
    });
}

fn is_inner_call_of_chain(node: Node) -> bool {
    // For TS: a `call_expression` whose parent is a `member_expression`
    // whose object is this call, and whose grandparent is another
    // `call_expression`.
    let Some(parent) = node.parent() else { return false };
    if parent.kind() != "member_expression" {
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
                    "member_expression" => {
                        let prop = function.child_by_field_name("property")?;
                        let attr_name = prop.utf8_text(source.as_bytes()).ok()?.to_string();
                        steps.push(CallStep {
                            method: attr_name,
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        current = function.child_by_field_name("object")?;
                    }
                    _ => return None,
                }
            }
            "member_expression" => {
                let prop = current.child_by_field_name("property")?;
                let attr_name = prop.utf8_text(source.as_bytes()).ok()?.to_string();
                steps.push(CallStep {
                    method: attr_name,
                    args_text: Vec::new(),
                    line: current.start_position().row + 1,
                    byte_range: current.byte_range(),
                });
                current = current.child_by_field_name("object")?;
            }
            "identifier" | "this" | "type_identifier" => {
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
            "await_expression" => {
                // `await foo.bar()` — walk through transparently.
                if let Some(inner) = current.named_child(0) {
                    current = inner;
                } else {
                    return None;
                }
            }
            "parenthesized_expression" => {
                if let Some(inner) = current.named_child(0) {
                    current = inner;
                } else {
                    return None;
                }
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

fn reconstruct_new_chain(
    node: Node,
    source: &str,
    ctx: &PyOrmContext<'_>,
) -> Option<CallChain> {
    let constructor = node.child_by_field_name("constructor")?;
    let class_name = constructor.utf8_text(source.as_bytes()).ok()?.to_string();
    let args_text = node
        .child_by_field_name("arguments")
        .and_then(|a| a.utf8_text(source.as_bytes()).ok())
        .map(split_top_level_args)
        .unwrap_or_default();
    let step = CallStep {
        method: class_name.clone(),
        args_text,
        line: node.start_position().row + 1,
        byte_range: node.byte_range(),
    };
    let in_loop = ctx.is_in_loop(node.start_byte());
    Some(CallChain {
        steps: vec![step],
        root: ChainRoot::Identifier(class_name),
        byte_range: node.byte_range(),
        in_loop,
    })
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
            (None, '"') | (None, '\'') | (None, '`') => {
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

fn infer_bindings(source: &str, ctx: &mut PyOrmContext<'_>) {
    // TS bindings come from `const x = ...`, `let x = ...`, `var x = ...`.
    // Look at the source prefix of each chain's outermost call: if the
    // pattern is `const|let|var IDENT = <chain>` (or simply `IDENT =`)
    // before the chain start, record the binding.
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
        let kind = kind.unwrap_or(BindingKind::Unknown);
        ctx.bindings
            .entry(lhs)
            .or_default()
            .push(Binding {
                kind,
                byte_range,
                scope: ScopeId(0),
            });
    }
}

fn extract_lhs_var(prefix: &str) -> Option<String> {
    let stripped = prefix.trim_end();
    let stripped = stripped.strip_suffix('=')?.trim_end();
    // Drop type annotation: `const x: Foo = ...` → lhs = "x"
    let last_token: &str = stripped.split_whitespace().last()?;
    let token = last_token.trim_end_matches(':').trim();
    let ident: String = token
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
    // Cap by previous semicolon OR newline-followed-by-non-whitespace.
    let semi = prefix.rfind(';').map(|i| i + 1);
    let nl = prefix.rfind('\n').map(|i| i + 1);
    match (semi, nl) {
        (Some(a), Some(b)) => a.max(b),
        (Some(a), None) => a,
        (None, Some(b)) => b,
        (None, None) => 0,
    }
}

fn classify_chain(chain: &CallChain) -> Option<BindingKind> {
    let root_text = match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => String::new(),
    };
    let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();

    // Prisma client: prisma.<model>.<op>(...) — root looks like an
    // identifier "prisma" or "db", first step is the model name, second
    // is the operation.
    if (root_text == "prisma" || root_text == "db" || root_text == "client")
        && methods.len() >= 2
    {
        let model = methods.first().map(|s| s.to_string());
        return Some(BindingKind::TsClient(TsClientFacts {
            kind: TsClientKind::Prisma,
            model,
        }));
    }
    // Drizzle: `db.select().from(table).where(...)` — root `db`, methods
    // include `select` / `insert` / `update` / `delete`.
    if methods.iter().any(|m| {
        matches!(*m, "select" | "insert" | "update" | "delete")
    }) && (root_text == "db" || root_text == "drizzle")
    {
        let table = chain
            .steps
            .iter()
            .find(|s| s.method == "from" || s.method == "into")
            .and_then(|s| s.args_text.first().cloned());
        return Some(BindingKind::TsClient(TsClientFacts {
            kind: TsClientKind::Drizzle,
            model: table,
        }));
    }
    // TypeORM: repository.find(...) / queryBuilder.where(...) — too
    // hard to classify here without imports; left to dialect matchers.
    None
}

fn propagate_loop_bindings(ctx: &mut PyOrmContext<'_>) {
    let pairs: Vec<(String, String, std::ops::Range<usize>)> = ctx
        .for_loops
        .iter()
        .map(|l| (l.loop_var.clone(), l.iterable_var.clone(), l.body_range.clone()))
        .collect();
    for (loop_var, iter_var, body_range) in pairs {
        let inner = iter_var.trim();
        let kind = match ctx.binding_at(inner, body_range.start) {
            Some(b) => match &b.kind {
                BindingKind::TsClient(_) => Some(BindingKind::TsClient(TsClientFacts {
                    kind: TsClientKind::Generic,
                    model: None,
                })),
                _ => None,
            },
            None => None,
        };
        if let Some(kind) = kind {
            ctx.bindings
                .entry(loop_var)
                .or_default()
                .push(Binding {
                    kind,
                    byte_range: body_range,
                    scope: ScopeId(1),
                });
        }
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
        p.set_language(&crate::languages::typescript::language()).unwrap();
        p.parse(src, None).unwrap()
    }

    #[test]
    fn reconstructs_prisma_chain() {
        let src = "const users = await prisma.user.findMany({ where: { active: true } });\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(!ctx.chains.is_empty());
        let methods: Vec<&str> = ctx.chains[0]
            .steps
            .iter()
            .map(|s| s.method.as_str())
            .collect();
        assert_eq!(methods, vec!["user", "findMany"]);
        match &ctx.chains[0].root {
            ChainRoot::Identifier(t) | ChainRoot::Binding(t) => {
                assert_eq!(t, "prisma");
            }
            r => panic!("unexpected root {r:?}"),
        }
    }

    #[test]
    fn detects_for_of_loop_var_propagation() {
        let src = "const users = await prisma.user.findMany();\nfor (const user of users) {\n  console.log(user.id);\n}\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let loops = &ctx.for_loops;
        assert_eq!(loops.len(), 1);
        assert_eq!(loops[0].loop_var, "user");
    }

    #[test]
    fn array_method_callback_creates_loop_marker() {
        let src = "users.map(u => u.posts.length);\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(!ctx.for_loops.is_empty(), "map(...) must create a loop range");
        assert_eq!(ctx.for_loops[0].loop_var, "u");
    }

    #[test]
    fn detects_typeorm_decorator() {
        let src = "class UserService {\n  @Get('/users')\n  async list() { return []; }\n}\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(ctx.decorators.iter().any(|d| d.decorator_expr.contains("Get")));
    }
}
