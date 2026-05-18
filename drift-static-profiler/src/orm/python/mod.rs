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
        "list_comprehension"
        | "set_comprehension"
        | "dictionary_comprehension"
        | "generator_expression" => handle_comprehension(node, source, &mut ctx),
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
    let var = field_text(node, "left", source);
    let iter = field_text(node, "right", source);
    let Some(body) = node.child_by_field_name("body") else {
        return;
    };
    // Use the parent-aware variant: tree-sitter Python sometimes hands us
    // a `block` whose byte_range collapses to a point on certain
    // multi-statement inputs. The variant falls back to the for_statement's
    // end so `in_loop` still covers chains in the body.
    push_iteration_node(ctx, var, iter, node, body, IterKind::ForLoop);
}

/// Treat `[expr for x in xs ...]`, `{...}`, `{k: v for ...}` and
/// `(expr for ...)` as loops so the N+1 analyzer sees attribute access
/// inside them. Tree-sitter exposes the loop var / iterable on a
/// `for_in_clause` child of the comprehension node.
fn handle_comprehension(node: Node, source: &str, ctx: &mut PyOrmContext<'_>) {
    let Some(clause) = find_named_child(node, "for_in_clause") else {
        return;
    };
    let var = field_text(clause, "left", source);
    let iter = field_text(clause, "right", source);
    // No explicit "body" — the whole comprehension node IS the body.
    // The body range gates `in_loop` for chains inside the expression.
    push_iteration(ctx, var, iter, node, IterKind::Comprehension);
}

fn push_iteration(
    ctx: &mut PyOrmContext<'_>,
    var: String,
    iter: String,
    body: Node,
    kind: IterKind,
) {
    if var.is_empty() {
        return;
    }
    let body_range = body.byte_range();
    let line_range = body.start_position().row + 1..body.end_position().row + 1;
    ctx.for_loops.push(LoopRange {
        iterable_var: iter,
        loop_var: var.clone(),
        body_range: body_range.clone(),
        line_range,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind,
        loop_var: var,
        body_range,
    });
}

/// Parent-aware variant of [`push_iteration`] for `for_statement` nodes.
///
/// Tree-sitter's `block` node occasionally reports a collapsed byte_range
/// (start == end) for some inputs. When that happens we fall back to the
/// for-statement's `end_byte()` so the loop body still covers chains in
/// the indented body — `in_loop` checks depend on this range being non-empty.
fn push_iteration_node(
    ctx: &mut PyOrmContext<'_>,
    var: String,
    iter: String,
    stmt: Node,
    body: Node,
    kind: IterKind,
) {
    if var.is_empty() {
        return;
    }
    let body_byte = body.byte_range();
    let effective = if body_byte.start == body_byte.end {
        body_byte.start..stmt.end_byte()
    } else {
        body_byte
    };
    let line_range = body.start_position().row + 1..stmt.end_position().row + 1;
    ctx.for_loops.push(LoopRange {
        iterable_var: iter,
        loop_var: var.clone(),
        body_range: effective.clone(),
        line_range,
    });
    ctx.iteration_markers.push(IterationMarker {
        kind,
        loop_var: var,
        body_range: effective,
    });
}

fn field_text(node: Node, field: &str, source: &str) -> String {
    node.child_by_field_name(field)
        .and_then(|n| n.utf8_text(source.as_bytes()).ok())
        .unwrap_or("")
        .to_string()
}

fn find_named_child<'tree>(node: Node<'tree>, kind: &str) -> Option<Node<'tree>> {
    let count = node.named_child_count();
    for i in 0..count {
        let child = node.named_child(i)?;
        if child.kind() == kind {
            return Some(child);
        }
    }
    None
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
            if !lhs.chars().all(|c| c.is_alphanumeric() || c == '_') || lhs.is_empty() {
                continue;
            }
            // Reject sub-expressions: there must be only whitespace between
            // the `=` and the chain start. Otherwise this chain is an inner
            // call (e.g. `joinedload(...)` inside `options(...)`) — recording
            // it would shadow the real outer assignment for the same `lhs`.
            let after_eq = &pre[eq + 1..];
            if !after_eq.chars().all(|c| c.is_whitespace()) {
                continue;
            }
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
                    for raw in &step.args_text {
                        let path = raw.trim_matches(['"', '\'']);
                        facts.select_related.insert_dunder_path(path);
                    }
                }
                "prefetch_related" => {
                    for raw in &step.args_text {
                        let path = raw.trim_matches(['"', '\'']);
                        facts.prefetched.insert_dunder_path(path);
                    }
                }
                "only" => {
                    facts.only_fields.extend(
                        step.args_text
                            .iter()
                            .map(|a| a.trim_matches(['"', '\'']).to_string()),
                    );
                }
                "values" | "values_list" => {
                    // `.values()` / `.values_list()` reduces rows to
                    // dicts / tuples — no relation can be lazy-loaded
                    // from such a row, so the queryset is permanently
                    // safe for the N+1 analyzer.
                    facts.is_values_query = true;
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
        let mut facts = QuerySetFacts {
            model: entity.clone(),
            ..Default::default()
        };
        // Collect eager-load paths from `.options(joinedload(...), selectinload(...), ...)`.
        for step in &chain.steps {
            if step.method == "options" {
                for arg in &step.args_text {
                    if let Some(path) = extract_sa_eager_field(arg) {
                        facts.prefetched.insert_dunder_path(&path);
                    }
                }
            }
        }
        return Some(BindingKind::SaSelect {
            entity,
            api: SaApiVersion::V2,
            facts,
        });
    }

    None
}

/// Extract the relation path from an SA eager-load call.
///
/// `"joinedload(User.posts)"` → `"posts"`
/// `"selectinload(User.orders.items)"` → `"orders__items"`
/// `"lazyload(User.comments)"` → `None` (not an eager load)
fn extract_sa_eager_field(arg: &str) -> Option<String> {
    let is_eager = arg.starts_with("joinedload(")
        || arg.starts_with("selectinload(")
        || arg.starts_with("contains_eager(");
    if !is_eager {
        return None;
    }
    let inner = arg.split_once('(')?.1.trim_end_matches(')').trim();
    // inner = "User.posts" or "User.posts.author" — skip the model name (first segment).
    let dot_idx = inner.find('.')?;
    let path = &inner[dot_idx + 1..];
    // Replace '.' with '__' for nested paths so PrefetchTree.insert_dunder_path works.
    Some(path.replace('.', "__"))
}

/// After chain/binding inference, walk the for-loop list and bind each
/// loop variable to an instance of the iterable's row type, scoped to
/// the loop body byte range.
fn propagate_loop_bindings(ctx: &mut PyOrmContext<'_>) {
    // Snapshot all SaSelect bindings up front — used by the embedded /
    // transitive lookups below. Doing this once avoids quadratic scans
    // and side-steps the borrow conflict with `ctx.bindings.entry(...)`.
    let sa_selects: Vec<(String, QuerySetFacts)> = ctx
        .bindings
        .iter()
        .filter_map(|(name, binds)| {
            binds.iter().rev().find_map(|b| {
                if let BindingKind::SaSelect { facts, .. } = &b.kind {
                    Some((name.clone(), facts.clone()))
                } else {
                    None
                }
            })
        })
        .collect();

    let pairs: Vec<(String, String, std::ops::Range<usize>)> = ctx
        .for_loops
        .iter()
        .map(|l| (l.loop_var.clone(), l.iterable_var.clone(), l.body_range.clone()))
        .collect();
    for (loop_var, iter_var, body_range) in pairs {
        let inner = iter_var.trim();

        // ── Django path ──────────────────────────────────────────────────
        // Only bind when the iterable is a tracked DjangoQuerySet — same
        // gate as before so `for x in [1,2,3]:` doesn't false-fire.
        let dj_facts = ctx.binding_at(inner, body_range.start).and_then(|b| {
            if let BindingKind::DjangoQuerySet(f) = &b.kind { Some(f.clone()) } else { None }
        });
        if let Some(f) = dj_facts {
            push_model_inst_binding(
                &mut ctx.bindings,
                &loop_var,
                body_range,
                f.model,
                Some(inner.to_string()),
            );
            continue;
        }

        // ── SQLAlchemy path ──────────────────────────────────────────────
        // Two sub-patterns:
        //
        // (A) `for user in stmt:` — iterable IS the SA select binding.
        let sa_direct = ctx.binding_at(inner, body_range.start).and_then(|b| {
            if let BindingKind::SaSelect { facts, .. } = &b.kind {
                Some((inner.to_string(), facts.clone()))
            } else {
                None
            }
        });
        if let Some((sa_name, f)) = sa_direct {
            push_model_inst_binding(
                &mut ctx.bindings,
                &loop_var,
                body_range,
                f.model,
                Some(sa_name),
            );
            continue;
        }

        // (B) `for user in session.scalars(stmt).all():` — a known SA
        // select binding name appears as a word inside the iter expression.
        let sa_embedded = sa_selects
            .iter()
            .find(|(name, _)| word_in_text(inner, name))
            .cloned();
        if let Some((sa_name, f)) = sa_embedded {
            push_model_inst_binding(
                &mut ctx.bindings,
                &loop_var,
                body_range,
                f.model,
                Some(sa_name),
            );
            continue;
        }

        // (C) Transitive: `users = <expr referencing stmt>; for user in users:`.
        // The iter_var is itself a binding whose producing chain references
        // an SA select binding in its args. Walk one hop further.
        let sa_transitive = ctx
            .binding_at(inner, body_range.start)
            .and_then(|b| {
                let chain = ctx
                    .chains
                    .iter()
                    .find(|c| c.byte_range == b.byte_range)?;
                for step in &chain.steps {
                    for arg in &step.args_text {
                        for (name, facts) in &sa_selects {
                            if word_in_text(arg, name) {
                                return Some((name.clone(), facts.clone()));
                            }
                        }
                    }
                }
                None
            });
        if let Some((sa_name, f)) = sa_transitive {
            push_model_inst_binding(
                &mut ctx.bindings,
                &loop_var,
                body_range,
                f.model,
                Some(sa_name),
            );
        }
    }
}

/// Push a `DjangoModelInst` binding for a loop variable.
///
/// Shared by the Django and SQLAlchemy propagation paths — the binding
/// shape is identical; only the source queryset name differs.
fn push_model_inst_binding(
    bindings: &mut super::context::BindingMap,
    loop_var: &str,
    body_range: std::ops::Range<usize>,
    model: Option<String>,
    source_queryset: Option<String>,
) {
    bindings
        .entry(loop_var.to_string())
        .or_insert_with(Vec::new)
        .push(Binding {
            kind: BindingKind::DjangoModelInst(ModelInstFacts { model, source_queryset }),
            byte_range: body_range,
            scope: ScopeId(1),
        });
}

/// Returns `true` if `word` appears as a complete identifier token inside
/// `text` (i.e. not adjacent to alphanumeric chars or underscores).
///
/// `word_in_text("session.scalars(stmt).all()", "stmt")` → `true`
/// `word_in_text("session.scalars(stmtx).all()", "stmt")` → `false`
fn word_in_text(text: &str, word: &str) -> bool {
    let wlen = word.len();
    let bytes = text.as_bytes();
    let wbytes = word.as_bytes();
    let mut start = 0;
    while start + wlen <= bytes.len() {
        if let Some(rel) = bytes[start..].windows(wlen).position(|w| w == wbytes) {
            let abs = start + rel;
            let before_ok = abs
                .checked_sub(1)
                .map(|i| !bytes[i].is_ascii_alphanumeric() && bytes[i] != b'_')
                .unwrap_or(true);
            let after_ok = bytes
                .get(abs + wlen)
                .map(|&c| !c.is_ascii_alphanumeric() && c != b'_')
                .unwrap_or(true);
            if before_ok && after_ok {
                return true;
            }
            start = abs + 1;
        } else {
            break;
        }
    }
    false
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
            assert!(crate::orm::n_plus_one::prefetch_tree::contains_top_level(
                &f.prefetched,
                "posts"
            ));
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
