//! Python-specific ORM scaffolding — shared between Django and
//! SQLAlchemy.
//!
//! The `build_context` entrypoint parses a Python source string with
//! tree-sitter, walks the tree once more to populate bindings + loops +
//! chains + class defs + decorators, and returns a `PyOrmContext` ready
//! for dialect matchers.

pub mod django;
pub mod sqlalchemy;

use super::context::{
    Binding, BindingKind, CallChain, CallStep, ChainRoot, ClassDef, DecoratorSite, FunctionDecl,
    IterKind, IterationMarker, LoopRange, ModelInstFacts, PyOrmContext, QuerySetFacts,
    SaApiVersion, ScopeId,
};
use tree_sitter::{Node, Tree};

/// Build a `PyOrmContext` for an in-memory Python source string.
///
/// **One iterative DFS pass** drives every collector — no recursion,
/// heap-bounded, predictable on pathological inputs. The post-passes
/// (binding inference, loop propagation, chain-root finalization) run
/// AFTER the single walk because they read state populated during it.
pub fn build_context<'a>(source: &'a str, tree: &'a Tree) -> PyOrmContext<'a> {
    let mut ctx = PyOrmContext {
        file: "<inline>",
        ..PyOrmContext::default()
    };
    super::walker::walk_tree(tree.root_node(), |node| match node.kind() {
        "import_statement" | "import_from_statement" => {
            handle_import_node(node, source, &mut ctx)
        }
        "class_definition" => handle_class_def(node, source, &mut ctx),
        "for_statement" => handle_for_loop(node, source, &mut ctx),
        "decorated_definition" => handle_decorator(node, source, &mut ctx),
        "function_definition" => handle_function(node, source, &mut ctx),
        "call" => {
            // Only register the OUTERMOST call of each chain; the
            // chain reconstructor walks inward from there.
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

/// After binding inference + loop propagation, re-classify any chain
/// root that's still an `Identifier` but matches a tracked binding —
/// promote it to `Binding(name)` / `LoopVar(name)` so matchers can
/// dispatch on root kind cheaply.
fn finalize_chain_roots(ctx: &mut PyOrmContext<'_>) {
    // Snapshot bindings keyset to avoid borrow conflict on ctx.
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

// ─── Per-node handlers (NO recursion) ───────────────────────────────────
//
// Each `handle_*` processes ONE tree-sitter node and updates `ctx`.
// The iterative DFS in `walker::walk_tree` invokes them via the
// dispatcher inside `build_context`. This replaces six per-purpose
// recursive walkers with a single shared traversal.

fn handle_import_node(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    match node.kind() {
        "import_statement" => {
            for i in 0..node.named_child_count() {
                if let Some(name) = node.named_child(i) {
                    if let Ok(text) = name.utf8_text(source.as_bytes()) {
                        ctx.imports.modules.insert(text.to_string(), vec![]);
                    }
                }
            }
        }
        "import_from_statement" => {
            let module = node
                .child_by_field_name("module_name")
                .and_then(|m| m.utf8_text(source.as_bytes()).ok())
                .unwrap_or("")
                .to_string();
            let mut names = Vec::new();
            for i in 0..node.named_child_count() {
                let Some(n) = node.named_child(i) else { continue };
                if n.kind() == "dotted_name" || n.kind() == "aliased_import" {
                    if let Ok(text) = n.utf8_text(source.as_bytes()) {
                        let bare = text.split(" as ").next().unwrap_or(text).trim().to_string();
                        names.push(bare.clone());
                        if let Some(alias) = text.split(" as ").nth(1) {
                            ctx.imports
                                .aliases
                                .insert(alias.trim().to_string(), format!("{module}.{bare}"));
                        }
                    }
                }
            }
            ctx.imports.modules.insert(module, names);
        }
        _ => {}
    }
}

fn handle_class_def(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let name = node
        .child_by_field_name("name")
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let base = node
        .child_by_field_name("superclasses")
        .and_then(|s| s.utf8_text(source.as_bytes()).ok())
        .map(|s| s.trim_matches(|c: char| c == '(' || c == ')').to_string());
    ctx.class_defs.push(ClassDef {
        name,
        base,
        byte_range: node.byte_range(),
        line: node.start_position().row + 1,
    });
}

fn handle_for_loop(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let var = node
        .child_by_field_name("left")
        .and_then(|l| l.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let iter = node
        .child_by_field_name("right")
        .and_then(|r| r.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    let Some(body) = node.child_by_field_name("body") else {
        return;
    };
    ctx.for_loops.push(LoopRange {
        iterable_var: iter.clone(),
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

fn handle_decorator(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let mut decorator_text = String::new();
    let mut fn_name = String::new();
    for i in 0..node.named_child_count() {
        let Some(n) = node.named_child(i) else { continue };
        if n.kind() == "decorator" {
            if let Ok(t) = n.utf8_text(source.as_bytes()) {
                decorator_text = t.to_string();
            }
        }
        if n.kind() == "function_definition" {
            if let Some(name) = n.child_by_field_name("name") {
                if let Ok(t) = name.utf8_text(source.as_bytes()) {
                    fn_name = t.to_string();
                }
            }
        }
    }
    ctx.decorators.push(DecoratorSite {
        decorator_expr: decorator_text,
        function_name: fn_name,
        line: node.start_position().row + 1,
        byte_range: node.byte_range(),
    });
}

fn handle_function(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let name = node
        .child_by_field_name("name")
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string();
    // Python: `async def` becomes a function_definition whose first
    // child is the keyword "async". Detect by scanning the source
    // prefix before the function name.
    let header_start = node.start_byte();
    let header_end = node
        .child_by_field_name("name")
        .map(|n| n.end_byte())
        .unwrap_or(header_start);
    let header = &source[header_start..header_end];
    let is_async = header.starts_with("async") || header.contains(" async ");
    ctx.functions.push(FunctionDecl {
        name,
        is_async,
        byte_range: node.byte_range(),
        line: node.start_position().row + 1,
    });
}

fn is_inner_call_of_chain(node: Node) -> bool {
    // A call C is an "inner" call of a chain when its parent is an
    // `attribute` whose `object` is C and that attribute is itself the
    // `function` of an outer `call`.
    let Some(parent) = node.parent() else { return false };
    if parent.kind() != "attribute" {
        return false;
    }
    let Some(grand) = parent.parent() else { return false };
    grand.kind() == "call"
}

// (collect_chains / walk_chains removed — chain handling now lives
// in `build_context`'s match arm for `"call"` nodes, driven by the
// shared iterative walker.)

fn reconstruct_chain(outer: Node, source: &str, ctx: &PyOrmContext<'_>) -> Option<CallChain> {
    let mut steps: Vec<CallStep> = Vec::new();
    let mut current = outer;
    loop {
        match current.kind() {
            "call" => {
                let function = current.child_by_field_name("function")?;
                let args_text = current
                    .child_by_field_name("arguments")
                    .and_then(|a| a.utf8_text(source.as_bytes()).ok())
                    .map(|s| split_top_level_args(s))
                    .unwrap_or_default();
                match function.kind() {
                    "identifier" => {
                        // bare top-level function call (e.g. `len(qs)` or `Paginator(...)`)
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
                    "attribute" => {
                        let attr_name = function
                            .child_by_field_name("attribute")?
                            .utf8_text(source.as_bytes())
                            .ok()?
                            .to_string();
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
            "attribute" => {
                // Property access without a call — e.g. `objects` in
                // `User.objects.filter(...)`. Treat as a no-arg step.
                let attr_name = current
                    .child_by_field_name("attribute")?
                    .utf8_text(source.as_bytes())
                    .ok()?
                    .to_string();
                steps.push(CallStep {
                    method: attr_name,
                    args_text: Vec::new(),
                    line: current.start_position().row + 1,
                    byte_range: current.byte_range(),
                });
                current = current.child_by_field_name("object")?;
            }
            "identifier" => {
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
            _ => {
                // Unrecognized root — return what we have with Unknown root.
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

fn classify_root(text: &str, ctx: &PyOrmContext<'_>) -> ChainRoot {
    let trimmed = text.trim();
    if ctx.bindings.contains_key(trimmed) {
        return ChainRoot::Binding(trimmed.to_string());
    }
    // Loop-var check — propagate_loop_bindings adds these to bindings,
    // but if a chain is encountered first we still want to see it as
    // an identifier and let the binding pass annotate later.
    ChainRoot::Identifier(trimmed.to_string())
}

fn split_top_level_args(args: &str) -> Vec<String> {
    // Strip outer parens and split on top-level commas (depth-aware
    // AND string-aware so commas inside `"a, b"` / `'a, b'` / f-strings
    // don't split the arg).
    let inner = args.trim();
    let inner = inner
        .strip_prefix('(')
        .and_then(|s| s.strip_suffix(')'))
        .unwrap_or(inner);
    let mut out: Vec<String> = Vec::new();
    let mut depth: i32 = 0;
    let mut cur = String::new();
    let mut in_string: Option<char> = None;
    let mut prev_escape = false;
    for ch in inner.chars() {
        match (in_string, ch) {
            (Some(q), c) if c == q && !prev_escape => {
                in_string = None;
                cur.push(c);
                prev_escape = false;
            }
            (Some(_), '\\') => {
                prev_escape = !prev_escape;
                cur.push(ch);
            }
            (Some(_), _) => {
                cur.push(ch);
                prev_escape = false;
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
            (None, _) => cur.push(ch),
        }
    }
    if !cur.trim().is_empty() {
        out.push(cur.trim().to_string());
    }
    out
}

/// Walk every reconstructed chain and infer bindings for the outermost
/// assignment LHS. Phase 1 covers `qs = User.objects.filter(...)` style.
fn infer_bindings(source: &str, ctx: &mut PyOrmContext<'_>) {
    // Re-walk assignments — we need the LHS, which the chain pass loses.
    // A direct pass on the source AST through tree-sitter would be
    // cleaner, but for Phase 1 we use a light regex-style heuristic:
    // every chain whose source begins after `<lhs> = ` is an
    // assignment.
    for chain in &ctx.chains {
        let stmt_start = previous_stmt_start(source, chain.byte_range.start);
        let pre = &source[stmt_start..chain.byte_range.start];
        if let Some(eq) = pre.rfind('=') {
            let lhs = pre[..eq].trim();
            if lhs.chars().all(|c| c.is_alphanumeric() || c == '_') && !lhs.is_empty() {
                // Always record the binding — kind defaults to Unknown
                // for chains we don't specifically classify (Django /
                // SQLAlchemy). Rules that just need "is this variable
                // the result of <this chain>?" use binding byte_range
                // equality regardless of kind.
                let kind = classify_chain(chain).unwrap_or(BindingKind::Unknown);
                ctx.bindings
                    .entry(lhs.to_string())
                    .or_insert_with(Vec::new)
                    .push(Binding {
                        kind,
                        byte_range: chain.byte_range.clone(),
                        scope: ScopeId(0),
                    });
            }
        }
    }
}

fn previous_stmt_start(source: &str, pos: usize) -> usize {
    let prefix = &source[..pos];
    prefix.rfind('\n').map(|i| i + 1).unwrap_or(0)
}

/// Map a recognized chain to a `BindingKind`. The matcher tables are
/// the smallest viable Phase-1 set; later phases append.
fn classify_chain(chain: &CallChain) -> Option<BindingKind> {
    // First step is closest to the root in source order.
    let first = chain.steps.first()?;
    let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
    let last_method = chain.steps.last()?.method.as_str();

    // Django shape: `<Model>.objects.<m>(...)`
    let root_text = match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => String::new(),
    };

    // Django entry: <Model>.objects.<m>(...). After reconstruction the
    // first step is `objects` (a property access) and the root is the
    // model identifier. Treat any uppercase-rooted chain with `objects`
    // in its method list as Django.
    let looks_django = methods.contains(&"objects")
        && root_text.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);
    if looks_django
    {
        // Look for terminal-method that collapses queryset → instance
        let terminator = matches!(last_method, "first" | "last" | "get");
        let mut facts = QuerySetFacts {
            model: Some(root_text.clone()),
            ..Default::default()
        };
        for step in &chain.steps {
            match step.method.as_str() {
                "select_related" => {
                    facts.select_related.extend(
                        step.args_text
                            .iter()
                            .map(|a| a.trim_matches(['"', '\'']).to_string()),
                    );
                }
                "prefetch_related" => {
                    facts.prefetched.extend(
                        step.args_text
                            .iter()
                            .map(|a| a.trim_matches(['"', '\'']).to_string()),
                    );
                }
                "only" => {
                    facts.only_fields.extend(
                        step.args_text
                            .iter()
                            .map(|a| a.trim_matches(['"', '\'']).to_string()),
                    );
                }
                _ => {}
            }
        }
        if terminator {
            return Some(BindingKind::DjangoModelInst(ModelInstFacts {
                model: facts.model,
                source_queryset: None,
            }));
        }
        return Some(BindingKind::DjangoQuerySet(facts));
    }

    // SQLAlchemy 2.x: `select(Model)` is a bare call with root = Identifier("select").
    if first.method == "select" {
        let entity = first.args_text.first().cloned();
        return Some(BindingKind::SaSelect {
            entity,
            api: SaApiVersion::V2,
        });
    }

    None
}

/// After chain/binding inference, walk the for-loop list and bind each
/// loop variable to an instance of the iterable's row type, scoped to
/// the loop body byte range.
fn propagate_loop_bindings(ctx: &mut PyOrmContext<'_>) {
    let pairs: Vec<(String, String, std::ops::Range<usize>)> = ctx
        .for_loops
        .iter()
        .map(|l| (l.loop_var.clone(), l.iterable_var.clone(), l.body_range.clone()))
        .collect();
    for (loop_var, iter_var, body_range) in pairs {
        let inner = iter_var.trim();
        // ONLY bind the loop var as a DjangoModelInst when the
        // iterable is itself a tracked DjangoQuerySet. Without this
        // gate, `for x in [1,2,3]:` and `for u in some_function():`
        // would bind their loop vars as Django model instances, and
        // rules like DJ-PERF-006 would false-positive on `u.save()`
        // even when no Django is involved.
        let qs_facts = ctx.binding_at(inner, body_range.start).and_then(|b| {
            if let BindingKind::DjangoQuerySet(f) = &b.kind {
                Some(f.clone())
            } else {
                None
            }
        });
        let Some(qs_facts) = qs_facts else {
            continue;
        };
        ctx.bindings
            .entry(loop_var.clone())
            .or_insert_with(Vec::new)
            .push(Binding {
                kind: BindingKind::DjangoModelInst(ModelInstFacts {
                    model: qs_facts.model,
                    source_queryset: Some(inner.to_string()),
                }),
                byte_range: body_range,
                scope: ScopeId(1),
            });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tree_sitter::Parser;

    fn parse(src: &str) -> Tree {
        let mut p = Parser::new();
        p.set_language(&tree_sitter_python::LANGUAGE.into()).unwrap();
        p.parse(src, None).unwrap()
    }

    #[test]
    fn binds_django_queryset() {
        let src = "qs = User.objects.filter(active=True)\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let b = ctx.binding("qs").expect("qs must be bound");
        match &b.kind {
            BindingKind::DjangoQuerySet(f) => {
                assert_eq!(f.model.as_deref(), Some("User"));
            }
            other => panic!("expected DjangoQuerySet, got {other:?}"),
        }
    }

    #[test]
    fn propagates_loop_var_binding() {
        let src = "qs = User.objects.filter(active=True)\nfor u in qs:\n    u.posts.count()\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let b = ctx.binding("u").expect("u must be loop-var bound");
        match &b.kind {
            BindingKind::DjangoModelInst(f) => {
                assert_eq!(f.model.as_deref(), Some("User"));
                assert_eq!(f.source_queryset.as_deref(), Some("qs"));
            }
            other => panic!("expected DjangoModelInst, got {other:?}"),
        }
    }

    #[test]
    fn detects_prefetch_related() {
        let src = "qs = User.objects.filter(active=True).prefetch_related('posts')\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let b = ctx.binding("qs").unwrap();
        if let BindingKind::DjangoQuerySet(f) = &b.kind {
            assert!(f.prefetched.contains(&"posts".to_string()));
        } else {
            panic!("expected DjangoQuerySet");
        }
    }

    #[test]
    fn reconstructs_chain_with_root_identifier() {
        let src = "User.objects.filter(active=True).all()\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        assert!(!ctx.chains.is_empty());
        let last = ctx.chains.last().unwrap();
        let methods: Vec<&str> = last.steps.iter().map(|s| s.method.as_str()).collect();
        assert_eq!(methods, vec!["objects", "filter", "all"]);
    }

    #[test]
    fn loop_chain_is_in_loop() {
        let src =
            "qs = User.objects.all()\nfor u in qs:\n    u.posts.count()\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        // The `u.posts.count()` chain should be in_loop.
        let inner = ctx
            .chains
            .iter()
            .find(|c| c.steps.iter().any(|s| s.method == "count"))
            .expect("count chain present");
        assert!(inner.in_loop);
    }

    #[test]
    fn split_top_level_args_is_string_aware() {
        // Regression test: a comma inside a string literal must NOT
        // split the arg. Without this guard, `filter(name="a, b")`
        // would produce two pseudo-args `name="a` and `b"` and break
        // any rule that scans `args_text`.
        let r = split_top_level_args("(name=\"foo, bar\", active=True)");
        assert_eq!(r.len(), 2, "got: {r:?}");
        assert_eq!(r[0], "name=\"foo, bar\"");
        assert_eq!(r[1], "active=True");
    }

    #[test]
    fn split_top_level_args_handles_nested_strings() {
        // `'a"b'` — outer quotes are single, the embedded double quote
        // must not flip the state.
        let r = split_top_level_args("('a\"b', 'c, d')");
        assert_eq!(r.len(), 2, "got: {r:?}");
    }

    #[test]
    fn loop_var_only_bound_when_iter_is_queryset() {
        // Regression: `for x in [1,2,3]` previously fake-bound x as a
        // DjangoModelInst with model=None. Now we only bind when the
        // iterable resolves to a tracked DjangoQuerySet.
        let src = "items = [1, 2, 3]\nfor i in items:\n    pass\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        // `i` must NOT be in bindings as a Django model instance.
        let i_is_django = ctx.binding("i").map(|b| matches!(
            b.kind,
            BindingKind::DjangoModelInst(_)
        )).unwrap_or(false);
        assert!(!i_is_django, "non-Django loop var must not be bound as DjangoModelInst");
    }

    #[test]
    fn for_loop_only_scope_for_loop_var() {
        let src = "qs = User.objects.all()\nfor u in qs:\n    pass\nu.posts\n";
        let tree = parse(src);
        let ctx = build_context(src, &tree);
        let b = ctx.binding("u").unwrap();
        let post_loop_pos = src.rfind("u.posts").unwrap();
        // Loop binding's byte_range must NOT contain post-loop references
        assert!(!b.byte_range.contains(&post_loop_pos));
    }
}
