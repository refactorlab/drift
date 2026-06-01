//! Kotlin ORM context builder — shared between Exposed + Ktorm.
//!
//! `tree-sitter-kotlin-ng` doesn't expose named fields on most nodes;
//! we treat children positionally:
//!   - `call_expression` named children: `[callee, value_arguments?, annotated_lambda?]`
//!   - `navigation_expression` named children: `[receiver, name]`
//!   - `for_statement` named children: `[variable_declaration, iterable, block]`
//!   - `lambda_literal` named children: `[lambda_parameters?, statements…]`
//!   - `binary_expression` named children: `[left, right]` with field-named operator
//!
//! Trailing-lambda calls like `xs.forEach { x -> … }` put the lambda
//! as a sibling of `value_arguments` under `call_expression`; we lift
//! those bodies into loop ranges so chains anchored inside them
//! correctly report `in_loop = true`.

pub mod exposed;
pub mod ktorm;

use crate::orm::context::{
    CallChain, CallStep, ChainRoot, ClassDef, DecoratorSite, IterKind, IterationMarker,
    LoopRange, PyOrmContext, ScopeId,
};
use tree_sitter::{Node, Tree};

pub fn build_context<'a>(source: &'a str, tree: &'a Tree) -> PyOrmContext<'a> {
    let mut ctx = PyOrmContext {
        source,
        file: "<inline>",
        ..PyOrmContext::default()
    };
    super::walker::walk_tree(tree.root_node(), |node| match node.kind() {
        "import" => handle_import(node, source, &mut ctx),
        "class_declaration" | "object_declaration" => {
            handle_class_def(node, source, &mut ctx)
        }
        "for_statement" => handle_for_statement(node, source, &mut ctx),
        "binary_expression" => handle_binary_concat(node, source, &mut ctx),
        "call_expression" => {
            handle_forEach_lambda(node, source, &mut ctx);
            if !is_inner_call_of_chain(node) {
                if let Some(chain) = reconstruct_chain(node, source) {
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

fn handle_import(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let Ok(text) = node.utf8_text(source.as_bytes()) else {
        return;
    };
    let raw = text
        .trim()
        .trim_start_matches("import ")
        .trim_end_matches(';')
        .trim()
        .trim_end_matches(".*")
        .trim();
    // `import a.b.c as d` — drop the alias suffix.
    let raw = raw.split(" as ").next().unwrap_or(raw).trim();
    ctx.imports.modules.insert(raw.to_string(), Vec::new());
    if let Some((module, _last)) = raw.rsplit_once('.') {
        ctx.imports
            .modules
            .insert(module.to_string(), Vec::new());
    }
}

fn handle_class_def(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let name = node
        .child_by_field_name("name")
        .or_else(|| {
            // `tree-sitter-kotlin-ng` exposes the name as a positional
            // `identifier` child (first named child after the keyword).
            (0..node.named_child_count())
                .filter_map(|i| node.named_child(i))
                .find(|c| c.kind() == "identifier")
        })
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

/// `for (id in ids) { body }` — register body as a loop range. Kotlin's
/// `for_statement` exposes children positionally: variable_declaration,
/// iterable expression, then `block`.
fn handle_for_statement(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let var = node
        .named_child(0)
        .and_then(|n| {
            if n.kind() == "variable_declaration" {
                n.named_child(0)
            } else {
                Some(n)
            }
        })
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let iter = node
        .named_child(1)
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    // Body is the last named child (the `block` / `control_structure_body`).
    let body = (0..node.named_child_count())
        .rev()
        .filter_map(|i| node.named_child(i))
        .find(|c| matches!(c.kind(), "block" | "control_structure_body" | "statement"))
        .unwrap_or(node);
    let body_byte = body.byte_range();
    let effective = if body_byte.start == body_byte.end {
        body_byte.start..node.end_byte()
    } else {
        body_byte
    };
    ctx.for_loops.push(LoopRange {
        iterable_var: iter,
        loop_var: var.clone(),
        body_range: effective.clone(),
        line_range: body.start_position().row + 1..node.end_position().row + 1,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind: IterKind::ForLoop,
        loop_var: var,
        body_range: effective,
    });
}

/// `xs.forEach { x -> … }` — pluck the lambda body out and treat it as
/// a loop range. Mirrors the Java stream-API hoist.
///
/// Kotlin (and Ktorm/Exposed in particular) uses trailing-lambda syntax
/// for many things that look like loops but execute the lambda ONCE:
/// `transaction { … }`, `useConnection { conn -> … }`,
/// `useTransaction { … }`, `apply { … }`, `let { … }`, `use { … }`,
/// `run { … }`, plus Ktorm `whereWithConditions { … }` and
/// `batchInsert { … }` builders. Treating those as loops would fire
/// spurious N+1 findings on idiomatic code. We dispatch ONLY on the
/// names that genuinely iterate per-element.
#[allow(non_snake_case)]
fn handle_forEach_lambda(call_node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    // Find the call's callee: first named child.
    let Some(callee) = call_node.named_child(0) else {
        return;
    };
    if callee.kind() != "navigation_expression" {
        return;
    }
    let Some(method_node) = callee.named_child(1) else {
        return;
    };
    let Ok(method) = method_node.utf8_text(source.as_bytes()) else {
        return;
    };
    // Per-element iteration: lambda is called once per item, so its body
    // is a legitimate loop scope.
    if !matches!(
        method,
        "forEach"
            | "forEachIndexed"
            | "map"
            | "mapNotNull"
            | "mapIndexed"
            | "flatMap"
            | "filter"
            | "filterNot"
            | "filterNotNull"
            | "onEach"
            | "fold"
            | "reduce"
            | "associate"
            | "associateBy"
            | "associateWith"
    ) {
        return;
    }
    // The trailing lambda is an `annotated_lambda` child of the call.
    let lambda_wrap = (0..call_node.named_child_count())
        .filter_map(|i| call_node.named_child(i))
        .find(|c| c.kind() == "annotated_lambda");
    let lambda = lambda_wrap.and_then(|wrap| {
        (0..wrap.named_child_count())
            .filter_map(|i| wrap.named_child(i))
            .find(|c| c.kind() == "lambda_literal")
    });
    let Some(lambda) = lambda else { return };
    // Lambda parameter: lambda_parameters → variable_declaration → identifier.
    let param = (0..lambda.named_child_count())
        .filter_map(|i| lambda.named_child(i))
        .find(|c| c.kind() == "lambda_parameters")
        .and_then(|p| p.named_child(0))
        .and_then(|vd| {
            if vd.kind() == "variable_declaration" {
                vd.named_child(0)
            } else {
                Some(vd)
            }
        })
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "it".to_string());
    let iter_var = callee
        .named_child(0)
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    ctx.for_loops.push(LoopRange {
        iterable_var: iter_var,
        loop_var: param.clone(),
        body_range: lambda.byte_range(),
        line_range: lambda.start_position().row + 1..lambda.end_position().row + 1,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind: IterKind::ForLoop,
        loop_var: param,
        body_range: lambda.byte_range(),
    });
}

/// `"…" + var` — stash the binary-expr text on `decorators` so the
/// SQL-injection rule can scan for string-literal + non-literal
/// concatenations without a second tree walk.
fn handle_binary_concat(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let op = node
        .child_by_field_name("operator")
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("");
    if op != "+" {
        return;
    }
    let Some(left) = node.child_by_field_name("left") else {
        return;
    };
    let Some(right) = node.child_by_field_name("right") else {
        return;
    };
    // We care about cases where at least one side is a string_literal
    // and the other isn't (a string-concat with a non-constant).
    let left_is_str = left.kind() == "string_literal";
    let right_is_str = right.kind() == "string_literal";
    if !(left_is_str ^ right_is_str) {
        return;
    }
    let text = node.utf8_text(source.as_bytes()).unwrap_or("").to_string();
    ctx.decorators.push(DecoratorSite {
        decorator_expr: format!("concat:{text}"),
        function_name: "concat".to_string(),
        line: node.start_position().row + 1,
        byte_range: node.byte_range(),
    });
}

fn is_inner_call_of_chain(node: Node) -> bool {
    let Some(parent) = node.parent() else {
        return false;
    };
    if parent.kind() != "navigation_expression" {
        return false;
    }
    // In a chain `a.b().c()`, the inner `a.b()` is the receiver of the
    // outer `navigation_expression` whose name is `c`. Receiver is the
    // first named child.
    parent
        .named_child(0)
        .map(|v| v.id() == node.id())
        .unwrap_or(false)
}

fn reconstruct_chain(outer: Node, source: &str) -> Option<CallChain> {
    let mut steps: Vec<CallStep> = Vec::new();
    let mut current = outer;
    loop {
        match current.kind() {
            "call_expression" => {
                let callee = current.named_child(0)?;
                match callee.kind() {
                    "navigation_expression" => {
                        let name_node = callee.named_child(1)?;
                        let name = name_node.utf8_text(source.as_bytes()).ok()?.to_string();
                        let args_text = (0..current.named_child_count())
                            .filter_map(|i| current.named_child(i))
                            .find(|c| c.kind() == "value_arguments")
                            .and_then(|a| a.utf8_text(source.as_bytes()).ok())
                            .map(|s| vec![s.to_string()])
                            .unwrap_or_default();
                        steps.push(CallStep {
                            method: name,
                            args_text,
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        current = callee.named_child(0)?;
                    }
                    "identifier" => {
                        let name = callee.utf8_text(source.as_bytes()).ok()?.to_string();
                        steps.push(CallStep {
                            method: name,
                            args_text: Vec::new(),
                            line: current.start_position().row + 1,
                            byte_range: current.byte_range(),
                        });
                        steps.reverse();
                        return Some(CallChain {
                            steps,
                            root: ChainRoot::Unknown,
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
            "navigation_expression" => {
                let name_node = current.named_child(1)?;
                let name = name_node.utf8_text(source.as_bytes()).ok()?.to_string();
                steps.push(CallStep {
                    method: name,
                    args_text: Vec::new(),
                    line: current.start_position().row + 1,
                    byte_range: current.byte_range(),
                });
                current = current.named_child(0)?;
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
        p.set_language(&crate::languages::kotlin::language()).unwrap();
        p.parse(src, None).unwrap()
    }

    #[test]
    fn detects_findbyid_chain_and_loop() {
        let src = r#"
import org.jetbrains.exposed.dao.IntEntity
fun bad(ids: List<Int>) {
  for (id in ids) {
    UserEntity.findById(id)
  }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let find = ctx
            .chains
            .iter()
            .find(|c| c.steps.last().map(|s| s.method.as_str()) == Some("findById"));
        assert!(find.is_some(), "expected findById chain, got {} chains", ctx.chains.len());
        assert!(find.unwrap().in_loop, "findById in for must be in_loop=true");
        assert!(ctx.imports.has_any_starting_with("org.jetbrains.exposed"));
    }

    #[test]
    fn detects_foreach_lambda_as_loop() {
        let src = r#"
fun f(ids: List<Int>) {
  ids.forEach { id ->
    UserEntity.findById(id)
  }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let find = ctx
            .chains
            .iter()
            .find(|c| c.steps.last().map(|s| s.method.as_str()) == Some("findById"));
        assert!(find.is_some());
        assert!(find.unwrap().in_loop, "findById in forEach must be in_loop=true");
    }

    #[test]
    fn let_lambda_is_not_a_loop() {
        let src = r#"
fun f(id: Int) {
  UserEntity.findById(id)?.let { it.name }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let find = ctx
            .chains
            .iter()
            .find(|c| c.steps.iter().any(|s| s.method == "findById"));
        assert!(find.is_some());
        assert!(!find.unwrap().in_loop, "findById inside `.let {{ ... }}` is NOT a loop");
    }

    #[test]
    fn captures_string_concat() {
        let src = r#"fun f(id: String) { val s = "SELECT * FROM u WHERE id = " + id }"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(ctx
            .decorators
            .iter()
            .any(|d| d.function_name == "concat" && d.decorator_expr.contains("SELECT")));
    }

    #[test]
    fn transaction_block_is_not_a_loop() {
        // `transaction { ... }` is a scope block — body runs ONCE.
        // The N+1 detector must not mark findById inside transaction
        // as in_loop=true.
        let src = r#"
fun f(id: Int) {
  transaction { UserEntity.findById(id) }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let find = ctx
            .chains
            .iter()
            .find(|c| c.steps.last().map(|s| s.method.as_str()) == Some("findById"));
        assert!(find.is_some());
        assert!(!find.unwrap().in_loop, "transaction is not a loop");
    }

    #[test]
    #[allow(non_snake_case)]
    fn useConnection_block_is_not_a_loop() {
        let src = r#"
fun f(id: Int) {
  database.useConnection { conn -> conn.prepareStatement("SELECT 1") }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let prep = ctx
            .chains
            .iter()
            .find(|c| c.steps.last().map(|s| s.method.as_str()) == Some("prepareStatement"));
        assert!(prep.is_some());
        assert!(!prep.unwrap().in_loop, "useConnection is not a loop");
    }

    #[test]
    #[allow(non_snake_case)]
    fn useTransaction_block_is_not_a_loop() {
        let src = r#"
fun f(users: List<User>) {
  database.useTransaction { tx ->
    UserEntity.findById(1)
  }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let find = ctx
            .chains
            .iter()
            .find(|c| c.steps.last().map(|s| s.method.as_str()) == Some("findById"));
        assert!(find.is_some());
        assert!(!find.unwrap().in_loop, "useTransaction is not a loop");
    }

    #[test]
    fn use_block_is_not_a_loop() {
        // `resource.use { … }` is the Kotlin closeable-using callback.
        let src = r#"
fun f(stmt: PreparedStatement) {
  stmt.use { it.executeQuery() }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let exec = ctx
            .chains
            .iter()
            .find(|c| c.steps.last().map(|s| s.method.as_str()) == Some("executeQuery"));
        assert!(exec.is_some());
        assert!(!exec.unwrap().in_loop, "use is not a loop");
    }

    #[test]
    fn run_apply_let_blocks_are_not_loops() {
        let src = r#"
fun f() {
  UserEntity.findById(1)?.let { it.flushChanges() }
  config.apply { name = "x" }
  data.run { process() }
}
"#;
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let flush = ctx
            .chains
            .iter()
            .find(|c| c.steps.iter().any(|s| s.method == "flushChanges"));
        assert!(flush.is_some());
        assert!(!flush.unwrap().in_loop, "let is not a loop");
    }
}
