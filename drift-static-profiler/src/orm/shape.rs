//! Generic, table-driven ORM shape detector.
//!
//! Solves the same problem across every dialect: "does this file use my
//! ORM even when no `import` of the package appears here?". The Python
//! side already proved this catches files where SA/Django come in
//! through inherited base classes (`self.session()` from a `BaseRepo`,
//! manager pattern through a `BaseModel`, etc.). The same shape exists
//! in every other ecosystem:
//!
//!   * **TypeScript NestJS** — repository injected via `@InjectRepository`;
//!     leaf file has no `import 'typeorm'`.
//!   * **TypeScript app code** — `prisma.user.findMany()` reached via a
//!     module re-export wrapper.
//!   * **Java Spring** — `@Autowired` `UserRepository` in a service class
//!     whose file imports only the entity, not `org.springframework.data.*`.
//!   * **Go** — gorm `*gorm.DB` returned by a helper.
//!   * **Rust** — sqlx pool passed in as `&PgPool`; leaf file doesn't
//!     name `sqlx` directly.
//!
//! Every per-language `OrmContext` (Python's `PyOrmContext` is the
//! universal type all dialects share) exposes
//! `chains: Vec<CallChain>` populated by the same chain-reconstructor.
//! That lets ONE detector serve every dialect — each ORM just hands us
//! its [`ShapeSpec`] and we walk the chains uniformly.
//!
//! ## Design — Open/Closed
//!
//! * **Open to extension**: adding a new ORM = adding one
//!   `const SHAPE: ShapeSpec = ShapeSpec { … };` constant in that
//!   dialect's file. No detector code changes.
//! * **Closed to modification**: the matcher itself is pure (no
//!   per-dialect branches). Adding ORMs cannot break existing detectors.
//!
//! Two evidence tiers — same shape that worked for Python:
//!
//! 1. **Anchor methods**: names so distinctive that ONE call site
//!    suffices (`joinedload`, `select_related`, `findByIdAndUpdate`,
//!    `AutoMigrate`, …). False-positive rate near zero.
//! 2. **Combo rules**: `(first_method, root_predicate,
//!    continuation_any)`. Catches generic verbs (`find`, `where`,
//!    `select`) that ARE the ORM API but appear in lots of
//!    non-ORM contexts too — disambiguate via root shape
//!    (`session.query`, `db.select(...).from(...)`,
//!    `<UpperCamel>.findAll()`).

use crate::orm::context::{CallChain, ChainRoot};

/// Per-ORM detection table. Plug into a dialect's `matches()` like:
///
/// ```ignore
/// fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
///     self.imports_match(ctx)
///         || shape::matches_by_shape(&ctx.chains, &Self::SHAPE)
/// }
/// ```
pub struct ShapeSpec {
    /// Anchor method names. Any single occurrence on any call step in
    /// any chain is sufficient evidence. Must be ORM-exclusive: don't
    /// list `filter`, `where`, `find` alone — those appear in pandas,
    /// lodash, RxJS, jQuery, etc. List things only this ORM exposes:
    /// `joinedload` (SQLAlchemy), `findByIdAndUpdate` (Mongoose),
    /// `AutoMigrate` (GORM), `$queryRaw` (Prisma), etc.
    pub anchors: &'static [&'static str],

    /// Combo rules for generic verbs whose ORM-ness only resolves when
    /// you look at the chain *root* (e.g. `session.query`,
    /// `db.select(...).from(...)`) or at what *follows* the verb
    /// (`select(...).where(...)`).
    pub combos: &'static [ComboRule],
}

/// One disambiguating combo. Fires when ALL of:
///
/// * the chain's first method equals [`Self::first_method`],
/// * the chain's root satisfies [`Self::root`],
/// * AND if [`Self::continuation_any`] is non-empty, at least one of
///   the chain's *remaining* methods is in the list.
///
/// Empty `continuation_any` means "no continuation requirement" —
/// useful when `first_method` is already distinctive once the root
/// shape is right (`<UpperCamel>.findAll()` is uniquely Sequelize).
pub struct ComboRule {
    pub first_method: &'static str,
    pub root: RootPredicate,
    pub continuation_any: &'static [&'static str],
}

/// How to test [`ChainRoot`] without leaking each dialect's specific
/// notion of "looks like a session / db handle / repository".
#[derive(Clone, Copy)]
pub enum RootPredicate {
    /// Any root (`Identifier`, `Binding`, `LoopVar`, `ModuleAttr`,
    /// even `Unknown`) is accepted. Use when `first_method` +
    /// `continuation_any` are already specific enough.
    Any,
    /// Case-insensitive substring match on the root identifier name.
    /// Use for `"session"` (matches `session`, `db_session`,
    /// `userSession`, `_session`, …). Doesn't match `Unknown`/`ModuleAttr`.
    ContainsIgnoreCase(&'static str),
    /// Exact case-sensitive match on the root identifier. Use for
    /// `"db"` / `"tx"` (GORM), `"sqlx"` (Rust), `"this"` (Java/TS this).
    Equals(&'static str),
    /// The root identifier starts with an uppercase letter — Django
    /// `<Model>.objects`, Sequelize `<Model>.findAll`,
    /// Mongoose `<Model>.find`, JPA `<EntityClass>` use this shape.
    FirstCharUppercase,
    /// `ChainRoot::ModuleAttr(module, _)` where the module matches.
    /// Use for Prisma's `prisma.user.findMany()` shape: the chain
    /// reconstructor records `("prisma", "user")` as a ModuleAttr root.
    ModuleAttrEquals(&'static str),
}

/// Pure, side-effect-free predicate. Returns `true` as soon as a chain
/// matches an anchor OR a combo. Cost is O(chains × steps + chains ×
/// combos) — bounded and predictable; no allocation.
pub fn matches_by_shape(chains: &[CallChain], spec: &ShapeSpec) -> bool {
    for chain in chains {
        // Tier 1 — anchor scan
        for step in &chain.steps {
            if spec.anchors.iter().any(|a| *a == step.method.as_str()) {
                return true;
            }
        }
        // Tier 2 — combo scan
        if spec.combos.is_empty() {
            continue;
        }
        let first = chain
            .steps
            .first()
            .map(|s| s.method.as_str())
            .unwrap_or("");
        if first.is_empty() {
            continue;
        }
        for combo in spec.combos {
            if combo.first_method != first {
                continue;
            }
            if !root_matches(&chain.root, combo.root) {
                continue;
            }
            if !combo.continuation_any.is_empty() {
                let any = chain
                    .steps
                    .iter()
                    .any(|s| combo.continuation_any.iter().any(|m| *m == s.method.as_str()));
                if !any {
                    continue;
                }
            }
            return true;
        }
    }
    false
}

fn root_matches(root: &ChainRoot, pred: RootPredicate) -> bool {
    let text: Option<&str> = match root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => Some(t.as_str()),
        ChainRoot::ModuleAttr(m, _) => Some(m.as_str()),
        ChainRoot::Unknown => None,
    };
    match pred {
        RootPredicate::Any => true,
        RootPredicate::ContainsIgnoreCase(needle) => {
            text.map(|t| t.to_ascii_lowercase().contains(&needle.to_ascii_lowercase()))
                .unwrap_or(false)
        }
        RootPredicate::Equals(s) => text.map(|t| t == s).unwrap_or(false),
        RootPredicate::FirstCharUppercase => text
            .and_then(|t| t.chars().next())
            .map(|c| c.is_uppercase())
            .unwrap_or(false),
        RootPredicate::ModuleAttrEquals(m) => matches!(
            root,
            ChainRoot::ModuleAttr(name, _) if name == m
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::context::{CallStep, ChainRoot};

    fn chain(root: ChainRoot, methods: &[&str]) -> CallChain {
        let steps = methods
            .iter()
            .map(|m| CallStep {
                method: (*m).to_string(),
                args_text: vec![],
                line: 1,
                byte_range: 0..0,
            })
            .collect();
        CallChain { steps, root, byte_range: 0..0, in_loop: false }
    }

    const SPEC: ShapeSpec = ShapeSpec {
        anchors: &["joinedload", "AutoMigrate"],
        combos: &[
            ComboRule {
                first_method: "query",
                root: RootPredicate::ContainsIgnoreCase("session"),
                continuation_any: &[],
            },
            ComboRule {
                first_method: "select",
                root: RootPredicate::Equals("db"),
                continuation_any: &["from"],
            },
            ComboRule {
                first_method: "findAll",
                root: RootPredicate::FirstCharUppercase,
                continuation_any: &[],
            },
            ComboRule {
                first_method: "user",
                root: RootPredicate::ModuleAttrEquals("prisma"),
                continuation_any: &[],
            },
        ],
    };

    #[test]
    fn anchor_one_hit_is_enough() {
        let c = chain(ChainRoot::Identifier("x".into()), &["foo", "joinedload", "bar"]);
        assert!(matches_by_shape(&[c], &SPEC));
    }

    #[test]
    fn combo_session_query() {
        let c = chain(ChainRoot::Binding("user_session".into()), &["query", "filter", "all"]);
        assert!(matches_by_shape(&[c], &SPEC));
    }

    #[test]
    fn combo_requires_continuation_when_set() {
        // `db.select().all()` lacks `from` — must NOT trigger.
        let c = chain(ChainRoot::Identifier("db".into()), &["select", "all"]);
        assert!(!matches_by_shape(&[c], &SPEC));
        // `db.select().from(...).limit(...)` triggers.
        let c = chain(ChainRoot::Identifier("db".into()), &["select", "from", "limit"]);
        assert!(matches_by_shape(&[c], &SPEC));
    }

    #[test]
    fn combo_first_char_uppercase() {
        let c = chain(ChainRoot::Identifier("User".into()), &["findAll"]);
        assert!(matches_by_shape(&[c], &SPEC));
        // lowercase root must not trigger.
        let c = chain(ChainRoot::Identifier("users".into()), &["findAll"]);
        assert!(!matches_by_shape(&[c], &SPEC));
    }

    #[test]
    fn combo_module_attr() {
        let c = chain(
            ChainRoot::ModuleAttr("prisma".into(), "user".into()),
            &["user", "findMany"],
        );
        assert!(matches_by_shape(&[c], &SPEC));
    }

    #[test]
    fn negative_unrelated_chain() {
        let c = chain(ChainRoot::Identifier("df".into()), &["filter", "groupby"]);
        assert!(!matches_by_shape(&[c], &SPEC));
    }
}
