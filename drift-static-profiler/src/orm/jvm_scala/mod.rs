//! Scala ORM context builder — shared between Slick + Quill.
//!
//! Mirror of `super::jvm/mod` but for `tree-sitter-scala` grammar:
//! `call_expression(function: field_expression(value, field))` for
//! `obj.method(args)`, `for_expression(enumerators, body)` for
//! Scala for-comprehensions, `interpolated_string_expression` for
//! `sql"…"` / `infix"…"`. Lambdas inside `.foreach { x => … }` are
//! lifted into loop bodies so chains anchored on closed-over receivers
//! still report `in_loop = true`.

pub mod quill;
pub mod slick;

use crate::orm::context::{
    CallChain, CallStep, ChainRoot, ClassDef, DecoratorSite, FunctionDecl, IterKind,
    IterationMarker, LoopRange, PyOrmContext, ScopeId,
};
use tree_sitter::{Node, Tree};

pub fn build_context<'a>(source: &'a str, tree: &'a Tree) -> PyOrmContext<'a> {
    let mut ctx = PyOrmContext {
        file: "<inline>",
        ..PyOrmContext::default()
    };
    super::walker::walk_tree(tree.root_node(), |node| match node.kind() {
        "import_declaration" => handle_import(node, source, &mut ctx),
        "class_definition" | "object_definition" | "trait_definition" => {
            handle_class_def(node, source, &mut ctx)
        }
        "function_definition" => handle_function_def(node, source, &mut ctx),
        "for_expression" => handle_for_comprehension(node, source, &mut ctx),
        "interpolated_string_expression" => handle_interpolation(node, source, &mut ctx),
        "call_expression" => {
            handle_foreach_lambda(node, source, &mut ctx);
            if !is_inner_call_of_chain(node) {
                if let Some(chain) = reconstruct_chain(node, source, &ctx) {
                    ctx.chains.push(chain);
                }
            }
        }
        _ => {}
    });
    finalize_chain_loop_flags(&mut ctx);
    let _ = ScopeId(0);
    ctx
}

/// `import slick.jdbc.PostgresProfile.api._` — the children under
/// `import_declaration` are alternating `identifier` / `.` tokens
/// followed by an optional `namespace_wildcard`. We rebuild the dotted
/// module path and stash both the full path and a prefix (Java-style).
fn handle_import(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let Ok(text) = node.utf8_text(source.as_bytes()) else {
        return;
    };
    let raw = text
        .trim()
        .trim_start_matches("import ")
        .trim_end_matches(';')
        .trim()
        .trim_end_matches("._")
        .trim_end_matches(".*")
        .trim();
    ctx.imports.modules.insert(raw.to_string(), Vec::new());
    if let Some((module, _last)) = raw.rsplit_once('.') {
        ctx.imports
            .modules
            .insert(module.to_string(), Vec::new());
    }
}

fn handle_function_def(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let name = node
        .child_by_field_name("name")
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    if name.is_empty() {
        return;
    }
    ctx.functions.push(FunctionDecl {
        name,
        is_async: false, // Scala async is library-level (Future), not a keyword.
        byte_range: node.byte_range(),
        line: node.start_position().row + 1,
    });
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

/// `for (id <- ids) { body }` — register `body` as a loop range so
/// `chain.in_loop` is true inside.
fn handle_for_comprehension(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    // Pull the first enumerator: `id <- ids`.
    let mut loop_var = String::new();
    let mut iter_var = String::new();
    if let Some(enums) = node.child_by_field_name("enumerators") {
        // `enumerators` is a wrapping node; named child 0 is the first `enumerator`.
        if let Some(first) = enums.named_child(0) {
            if first.kind() == "enumerator" {
                if let Some(v) = first.named_child(0) {
                    loop_var = v.utf8_text(source.as_bytes()).unwrap_or("").to_string();
                }
                if let Some(v) = first.named_child(1) {
                    iter_var = v.utf8_text(source.as_bytes()).unwrap_or("").to_string();
                }
            }
        }
    }
    let body = node.child_by_field_name("body");
    let Some(body) = body else { return };
    let body_byte = body.byte_range();
    let effective = if body_byte.start == body_byte.end {
        body_byte.start..node.end_byte()
    } else {
        body_byte
    };
    let line_range = body.start_position().row + 1..node.end_position().row + 1;
    ctx.for_loops.push(LoopRange {
        iterable_var: iter_var,
        loop_var: loop_var.clone(),
        body_range: effective.clone(),
        line_range,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind: IterKind::ForLoop,
        loop_var,
        body_range: effective,
    });
}

/// `xs.foreach { x => … }` — extract the lambda body and register it
/// as a loop range. Mirrors the Java stream-API hoist.
fn handle_foreach_lambda(call_node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let Some(func) = call_node.child_by_field_name("function") else {
        return;
    };
    if func.kind() != "field_expression" {
        return;
    }
    let Some(field) = func.child_by_field_name("field") else {
        return;
    };
    let Ok(method) = field.utf8_text(source.as_bytes()) else {
        return;
    };
    if !matches!(
        method,
        "foreach" | "map" | "flatMap" | "filter" | "withFilter" | "tapEach"
    ) {
        return;
    }
    // The arguments of a Scala block-style call may be either an
    // `arguments` node (parenthesised) or a `block` node (curly-brace
    // trailing form: `xs.foreach { … }`). Both can contain a
    // `lambda_expression`.
    let Some(args) = call_node.child_by_field_name("arguments") else {
        return;
    };
    let target = match args.kind() {
        // `(x => …)` — drill into the single child.
        "arguments" => args.named_child(0),
        // `{ x => … }` — the block IS the lambda holder; the lambda
        // is the first named child.
        "block" => args.named_child(0),
        _ => None,
    };
    let Some(lambda) = target else { return };
    if lambda.kind() != "lambda_expression" {
        return;
    }
    let param = lambda
        .child_by_field_name("parameters")
        .and_then(|p| p.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .trim_matches(|c: char| c == '(' || c == ')')
        .to_string();
    // Lambda body is the lambda node's range minus the prefix params.
    // tree-sitter-scala emits an `indented_block` as the body sibling.
    let body_node = (0..lambda.named_child_count())
        .filter_map(|i| lambda.named_child(i))
        .find(|c| c.kind() != "identifier")
        .unwrap_or(lambda);
    let iter_var = call_node
        .child_by_field_name("function")
        .and_then(|f| f.child_by_field_name("value"))
        .and_then(|v| v.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    ctx.for_loops.push(LoopRange {
        iterable_var: iter_var,
        loop_var: param.clone(),
        body_range: body_node.byte_range(),
        line_range: body_node.start_position().row + 1..body_node.end_position().row + 1,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind: IterKind::ForLoop,
        loop_var: param,
        body_range: body_node.byte_range(),
    });
}

/// `sql"… #${id} …"` / `infix"…"` — stash the raw interpolated-string
/// text on `decorators` so rule matchers can inspect it without
/// re-walking the tree.
fn handle_interpolation(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let text = node.utf8_text(source.as_bytes()).unwrap_or("").to_string();
    let interpolator = node
        .child_by_field_name("interpolator")
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    ctx.decorators.push(DecoratorSite {
        decorator_expr: format!("interp:{interpolator}:{text}"),
        function_name: interpolator,
        line: node.start_position().row + 1,
        byte_range: node.byte_range(),
    });
}

fn is_inner_call_of_chain(node: Node) -> bool {
    // True if this `call_expression` is the receiver value of an
    // outer `field_expression` (i.e. one step in a longer chain).
    let Some(parent) = node.parent() else {
        return false;
    };
    if parent.kind() != "field_expression" {
        return false;
    }
    parent
        .child_by_field_name("value")
        .map(|v| v.id() == node.id())
        .unwrap_or(false)
}

fn reconstruct_chain(outer: Node, source: &str, _ctx: &PyOrmContext<'_>) -> Option<CallChain> {
    let mut steps: Vec<CallStep> = Vec::new();
    let mut current = outer;
    loop {
        match current.kind() {
            "call_expression" => {
                let func = current.child_by_field_name("function")?;
                match func.kind() {
                    "field_expression" => {
                        let name = func
                            .child_by_field_name("field")?
                            .utf8_text(source.as_bytes())
                            .ok()?
                            .to_string();
                        let args_text = current
                            .child_by_field_name("arguments")
                            .and_then(|a| a.utf8_text(source.as_bytes()).ok())
                            .map(|s| vec![s.to_string()])
                            .unwrap_or_default();
                        steps.push(CallStep {
                            method: name,
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        current = func.child_by_field_name("value")?;
                    }
                    "identifier" => {
                        let name = func.utf8_text(source.as_bytes()).ok()?.to_string();
                        let args_text = current
                            .child_by_field_name("arguments")
                            .and_then(|a| a.utf8_text(source.as_bytes()).ok())
                            .map(|s| split_top_level_args(s))
                            .unwrap_or_default();
                        steps.push(CallStep {
                            method: name.clone(),
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        steps.reverse();
                        return Some(CallChain {
                            steps,
                            root: ChainRoot::Identifier(name),
                            byte_range: outer.byte_range(),
                            in_loop: false,
                        });
                    }
                    "generic_function" => {
                        // `foo[T](args)` — pluck the method name from inside.
                        let inner_func = func.child_by_field_name("function");
                        let name = inner_func
                            .and_then(|f| f.utf8_text(source.as_bytes()).ok())
                            .unwrap_or("")
                            .to_string();
                        let args_text = current
                            .child_by_field_name("arguments")
                            .and_then(|a| a.utf8_text(source.as_bytes()).ok())
                            .map(|s| split_top_level_args(s))
                            .unwrap_or_default();
                        steps.push(CallStep {
                            method: name.clone(),
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        steps.reverse();
                        return Some(CallChain {
                            steps,
                            root: ChainRoot::Identifier(name),
                            byte_range: outer.byte_range(),
                            in_loop: false,
                        });
                    }
                    _ => {
                        steps.reverse();
                        return Some(CallChain {
                            steps,
                            root: ChainRoot::Unknown,
                            byte_range: outer.byte_range(),
                            in_loop: false,
                        });
                    }
                }
            }
            "field_expression" => {
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
                current = current.child_by_field_name("value")?;
            }
            "identifier" => {
                let text = current.utf8_text(source.as_bytes()).ok()?.to_string();
                steps.reverse();
                return Some(CallChain {
                    steps,
                    root: ChainRoot::Identifier(text),
                    byte_range: outer.byte_range(),
                    in_loop: false,
                });
            }
            "generic_function" => {
                // `sql"…".as[Foo]` / `dynamicQuery[Person]` — push the
                // inner function as a step so chain matchers can see
                // the method name (`as`, `dynamicQuery`, etc.).
                let Some(inner) = current.child_by_field_name("function") else {
                    steps.reverse();
                    return Some(CallChain {
                        steps,
                        root: ChainRoot::Unknown,
                        byte_range: outer.byte_range(),
                        in_loop: false,
                    });
                };
                // If the inner function is a bare identifier, this is the
                // root of the chain: push it as a step AND set the root.
                if inner.kind() == "identifier" {
                    let name = inner.utf8_text(source.as_bytes()).ok()?.to_string();
                    steps.push(CallStep {
                        method: name.clone(),
                        args_text: Vec::new(),
                        line: current.start_position().row + 1,
                        byte_range: current.byte_range(),
                    });
                    steps.reverse();
                    return Some(CallChain {
                        steps,
                        root: ChainRoot::Identifier(name),
                        byte_range: outer.byte_range(),
                        in_loop: false,
                    });
                }
                // Otherwise drill through (`sql"…".as[Foo]` → field_expression).
                current = inner;
            }
            _ => {
                steps.reverse();
                return Some(CallChain {
                    steps,
                    root: ChainRoot::Unknown,
                    byte_range: outer.byte_range(),
                    in_loop: false,
                });
            }
        }
    }
}

/// Split a parenthesised argument list `(a, b(c, d), "x,y")` into
/// `["a", "b(c, d)", "\"x,y\""]`. Respects nested parens/brackets and
/// quoted strings so commas inside them don't split. Mirrors the
/// helper in `jvm/mod.rs`.
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

/// Second pass: now that all loop ranges are recorded, set
/// `in_loop` on each chain whose call site falls inside one.
fn finalize_chain_loop_flags(ctx: &mut PyOrmContext<'_>) {
    let loops: Vec<std::ops::Range<usize>> =
        ctx.for_loops.iter().map(|l| l.body_range.clone()).collect();
    for chain in &mut ctx.chains {
        let pos = chain.byte_range.start;
        chain.in_loop = loops.iter().any(|r| r.contains(&pos));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tree_sitter::Parser;

    fn parse(src: &str) -> Tree {
        let mut p = Parser::new();
        p.set_language(&crate::languages::scala::language()).unwrap();
        p.parse(src, None).unwrap()
    }

    #[test]
    fn detects_slick_chain_and_loop() {
        let src = r#"
import slick.jdbc.PostgresProfile.api._
object Foo {
  def bad(ids: Seq[Long]) = {
    for (id <- ids) { db.run(query) }
  }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(ctx.imports.has_any_starting_with("slick"));
        // The chain for `db.run(query)` must be marked in_loop.
        let db_run = ctx
            .chains
            .iter()
            .find(|c| c.steps.last().map(|s| s.method.as_str()) == Some("run"));
        assert!(db_run.is_some(), "expected db.run chain, got {} chains", ctx.chains.len());
        assert!(db_run.unwrap().in_loop, "db.run inside `for` must be in_loop=true");
    }

    #[test]
    fn detects_foreach_lambda_as_loop() {
        let src = r#"
object Foo {
  def f(xs: Seq[Long]) = xs.foreach { x => ctx.run(quote { query[User].filter(_.id == lift(x)) }) }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let ctx_run = ctx
            .chains
            .iter()
            .find(|c| c.steps.last().map(|s| s.method.as_str()) == Some("run"));
        assert!(ctx_run.is_some());
        assert!(ctx_run.unwrap().in_loop, "ctx.run inside foreach lambda must be in_loop=true");
    }

    #[test]
    fn captures_interpolated_string() {
        let src = r#"object Foo { val q = sql"SELECT * FROM u WHERE x = #${id}" }"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(ctx
            .decorators
            .iter()
            .any(|d| d.function_name == "sql" && d.decorator_expr.contains("#$")));
    }
}
