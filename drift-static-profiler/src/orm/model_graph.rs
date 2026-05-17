//! Project-wide model graph — resolves cross-file model + relationship
//! declarations so rules that need schema knowledge (e.g. "is `posts`
//! a *-to-many on User?") can run.
//!
//! Phase 5 v1: Django + SQLAlchemy + JPA. Built by a single pre-pass
//! over every source file in the project before per-file dialect rules
//! run.

use std::collections::HashMap;

/// One model declaration discovered in the workspace.
#[derive(Debug, Clone)]
pub struct ModelDecl {
    pub name: String,
    pub language: ModelLang,
    pub source_file: String,
    pub line: usize,
    pub fields: Vec<ModelField>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelLang {
    Django,
    SqlAlchemy,
    Jpa,
}

#[derive(Debug, Clone)]
pub struct ModelField {
    pub name: String,
    pub kind: FieldKind,
    /// Target model name when this field is a relationship.
    pub target: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FieldKind {
    Scalar,
    ForeignKey,       // FK / @ManyToOne — to-one
    OneToOne,
    OneToMany,        // reverse FK / @OneToMany
    ManyToMany,       // @ManyToMany / Django M2M
    Relationship,     // SQLAlchemy `relationship(...)` of unknown cardinality
}

impl FieldKind {
    pub fn is_collection(&self) -> bool {
        matches!(self, FieldKind::OneToMany | FieldKind::ManyToMany)
    }
}

/// Project-wide model registry. Indexed by model name (last component
/// of the class name) so a chain like `User.objects.<m>` can resolve.
#[derive(Debug, Default, Clone)]
pub struct ModelGraph {
    pub models: HashMap<String, ModelDecl>,
}

impl ModelGraph {
    /// Build a `ModelGraph` from a workspace by parsing every `.py` /
    /// `.java` source file. Drops files that fail to parse — soft-fail
    /// per the `Soft-fail policy` section of master plan §III.
    ///
    /// This variant re-reads each file from disk. Prefer
    /// [`Self::build_from_sources`] when the caller already has source
    /// strings in hand — avoids a second I/O pass.
    pub fn build(workspace_files: &[std::path::PathBuf]) -> Self {
        let mut graph = ModelGraph::default();
        for file in workspace_files {
            if let Some(ext) = file.extension().and_then(|s| s.to_str()) {
                match ext {
                    "py" => extract_python(file, &mut graph),
                    "java" => extract_java(file, &mut graph),
                    _ => {}
                }
            }
        }
        graph
    }

    /// Build a `ModelGraph` from `(path, source)` pairs the caller
    /// already has in memory. This is the I/O-free path used by
    /// `scan_workspace` after its single walk has filtered files +
    /// loaded sources into a cache — avoiding a second `read_to_string`
    /// per file.
    pub fn build_from_sources<'a, I>(items: I) -> Self
    where
        I: IntoIterator<Item = (&'a std::path::Path, &'a str)>,
    {
        let mut graph = ModelGraph::default();
        for (file, source) in items {
            let Some(ext) = file.extension().and_then(|s| s.to_str()) else {
                continue;
            };
            match ext {
                "py" => extract_python_from_source(file, source, &mut graph),
                "java" => extract_java_from_source(file, source, &mut graph),
                _ => {}
            }
        }
        graph
    }

    /// Build a `ModelGraph` from `ParsedFile`s whose tree-sitter trees
    /// are already in memory. This is the **optimal** path used by
    /// `scan_workspace` — zero re-reads AND zero re-parses; we walk
    /// each cached tree exactly once for model declarations.
    pub fn from_parsed(parsed: &[super::ParsedFile]) -> Self {
        let mut graph = ModelGraph::default();
        for pf in parsed {
            match pf.lang {
                super::FileLang::Python => {
                    extract_python_from_tree(&pf.tree, &pf.source, &pf.path, &mut graph);
                }
                super::FileLang::Java => {
                    extract_java_from_tree(&pf.tree, &pf.source, &pf.path, &mut graph);
                }
                _ => {}
            }
        }
        graph
    }

    /// True if `model.field` is a *-to-many relation. Used by
    /// `DJ-PROJ-010` and SQLAlchemy joinedload-on-collection rules.
    pub fn is_collection_field(&self, model: &str, field: &str) -> bool {
        let Some(m) = self.models.get(model) else {
            return false;
        };
        m.fields
            .iter()
            .any(|f| f.name == field && f.kind.is_collection())
    }

    /// True if `model.field` is a relationship of any kind.
    pub fn is_relation_field(&self, model: &str, field: &str) -> bool {
        let Some(m) = self.models.get(model) else {
            return false;
        };
        m.fields.iter().any(|f| {
            f.name == field
                && !matches!(f.kind, FieldKind::Scalar)
        })
    }

    /// Look up the target model for a relation.
    pub fn target_of(&self, model: &str, field: &str) -> Option<&str> {
        let m = self.models.get(model)?;
        m.fields
            .iter()
            .find(|f| f.name == field)
            .and_then(|f| f.target.as_deref())
    }

    pub fn is_empty(&self) -> bool {
        self.models.is_empty()
    }
}

// ─── Python (Django + SQLAlchemy) extraction ────────────────────────────

fn extract_python(file: &std::path::Path, graph: &mut ModelGraph) {
    let Ok(source) = std::fs::read_to_string(file) else {
        return;
    };
    extract_python_from_source(file, &source, graph);
}

fn extract_python_from_source(file: &std::path::Path, source: &str, graph: &mut ModelGraph) {
    if !python_looks_like_models(source) {
        return;
    }
    let mut parser = tree_sitter::Parser::new();
    if parser
        .set_language(&tree_sitter_python::LANGUAGE.into())
        .is_err()
    {
        return;
    }
    let Some(tree) = parser.parse(source, None) else {
        return;
    };
    walk_py(tree.root_node(), source, file, graph);
}

/// Pure-tree variant: walks a tree-sitter `Tree` that the caller
/// already parsed. Used by [`ModelGraph::from_parsed`] so we don't
/// re-parse files that `scan_workspace` has already parsed.
fn extract_python_from_tree(
    tree: &tree_sitter::Tree,
    source: &str,
    file: &std::path::Path,
    graph: &mut ModelGraph,
) {
    if !python_looks_like_models(source) {
        return;
    }
    walk_py(tree.root_node(), source, file, graph);
}

fn python_looks_like_models(source: &str) -> bool {
    // Fast prefilter — only walk files whose source mentions a
    // model-shaped base class. Avoids tree-walking 95% of files in a
    // Django monolith that don't declare models.
    source.contains("models.Model")
        || source.contains("declarative_base")
        || source.contains("DeclarativeBase")
        || (source.contains("class ") && source.contains("(Base)"))
}

fn walk_py(
    node: tree_sitter::Node,
    source: &str,
    file: &std::path::Path,
    graph: &mut ModelGraph,
) {
    if node.kind() == "class_definition" {
        let name = node
            .child_by_field_name("name")
            .and_then(|n| n.utf8_text(source.as_bytes()).ok())
            .unwrap_or("")
            .to_string();
        let bases_text = node
            .child_by_field_name("superclasses")
            .and_then(|s| s.utf8_text(source.as_bytes()).ok())
            .unwrap_or("");
        let is_django = bases_text.contains("models.Model")
            || bases_text.contains("(Model")
            || bases_text.contains(", Model");
        let is_sa = bases_text.contains("Base")
            || bases_text.contains("DeclarativeBase");
        if !name.is_empty() && (is_django || is_sa) {
            let body = node.child_by_field_name("body");
            let mut fields = Vec::new();
            if let Some(body) = body {
                let mut cur = body.walk();
                if cur.goto_first_child() {
                    loop {
                        let stmt = cur.node();
                        extract_py_field(stmt, source, &mut fields);
                        if !cur.goto_next_sibling() {
                            break;
                        }
                    }
                }
            }
            graph.models.insert(
                name.clone(),
                ModelDecl {
                    name,
                    language: if is_django {
                        ModelLang::Django
                    } else {
                        ModelLang::SqlAlchemy
                    },
                    source_file: file.display().to_string(),
                    line: node.start_position().row + 1,
                    fields,
                },
            );
        }
    }
    let mut cur = node.walk();
    if cur.goto_first_child() {
        loop {
            walk_py(cur.node(), source, file, graph);
            if !cur.goto_next_sibling() {
                break;
            }
        }
    }
}

fn extract_py_field(
    stmt: tree_sitter::Node,
    source: &str,
    out: &mut Vec<ModelField>,
) {
    // Look for `name = models.<Kind>(...)` or
    // `name: Mapped[<T>] = relationship(...)`.
    let text = stmt.utf8_text(source.as_bytes()).unwrap_or("");
    let Some((lhs, rhs)) = text.split_once('=') else {
        return;
    };
    let lhs = lhs.trim();
    let rhs = rhs.trim();
    // Take the bare name (strip type annotation).
    let name: String = lhs
        .split(':')
        .next()
        .unwrap_or(lhs)
        .chars()
        .take_while(|c| c.is_alphanumeric() || *c == '_')
        .collect();
    if name.is_empty() {
        return;
    }
    // Detect kind from RHS.
    let kind = if rhs.contains("models.ForeignKey") {
        FieldKind::ForeignKey
    } else if rhs.contains("models.OneToOneField") {
        FieldKind::OneToOne
    } else if rhs.contains("models.ManyToManyField") {
        FieldKind::ManyToMany
    } else if rhs.starts_with("relationship(") {
        // SQLAlchemy: look for `uselist=False` or `Mapped[List[...]]` in lhs.
        if lhs.contains("List[") || rhs.contains("uselist=True") {
            FieldKind::OneToMany
        } else if lhs.contains("Mapped[") && !lhs.contains("List[") {
            FieldKind::OneToOne
        } else {
            FieldKind::Relationship
        }
    } else if rhs.starts_with("models.") {
        FieldKind::Scalar
    } else {
        return;
    };
    // Extract first positional arg as the target model name.
    let target = extract_first_arg(rhs)
        .map(|s| s.trim_matches(['"', '\'']).to_string())
        .filter(|s| !s.is_empty());
    out.push(ModelField { name, kind, target });
}

fn extract_first_arg(rhs: &str) -> Option<String> {
    let open = rhs.find('(')?;
    let close = matching_paren(&rhs[open..])? + open;
    let inside = &rhs[open + 1..close];
    let arg = inside.split(',').next()?.trim();
    Some(arg.to_string())
}

fn matching_paren(s: &str) -> Option<usize> {
    let mut depth = 0_i32;
    for (i, c) in s.char_indices() {
        match c {
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

// ─── Java (JPA) extraction ──────────────────────────────────────────────

fn extract_java(file: &std::path::Path, graph: &mut ModelGraph) {
    let Ok(source) = std::fs::read_to_string(file) else {
        return;
    };
    extract_java_from_source(file, &source, graph);
}

fn extract_java_from_source(file: &std::path::Path, source: &str, graph: &mut ModelGraph) {
    if !source.contains("@Entity") {
        return;
    }
    let mut parser = tree_sitter::Parser::new();
    if parser
        .set_language(&crate::languages::java::language())
        .is_err()
    {
        return;
    }
    let Some(tree) = parser.parse(source, None) else {
        return;
    };
    walk_java(tree.root_node(), &source, file, graph);
}

/// Pure-tree variant for Java — used by `ModelGraph::from_parsed`
/// to avoid re-parsing files that `scan_workspace` already parsed.
fn extract_java_from_tree(
    tree: &tree_sitter::Tree,
    source: &str,
    file: &std::path::Path,
    graph: &mut ModelGraph,
) {
    if !source.contains("@Entity") {
        return;
    }
    walk_java(tree.root_node(), source, file, graph);
}

fn walk_java(
    node: tree_sitter::Node,
    source: &str,
    file: &std::path::Path,
    graph: &mut ModelGraph,
) {
    if node.kind() == "class_declaration" {
        // Check for @Entity annotation in modifiers.
        let has_entity = node
            .utf8_text(source.as_bytes())
            .map(|t| t.contains("@Entity"))
            .unwrap_or(false);
        if has_entity {
            let name = node
                .child_by_field_name("name")
                .and_then(|n| n.utf8_text(source.as_bytes()).ok())
                .unwrap_or("")
                .to_string();
            let mut fields = Vec::new();
            if let Some(body) = node.child_by_field_name("body") {
                let mut cur = body.walk();
                if cur.goto_first_child() {
                    loop {
                        let n = cur.node();
                        if n.kind() == "field_declaration" {
                            extract_java_field(n, source, &mut fields);
                        }
                        if !cur.goto_next_sibling() {
                            break;
                        }
                    }
                }
            }
            graph.models.insert(
                name.clone(),
                ModelDecl {
                    name,
                    language: ModelLang::Jpa,
                    source_file: file.display().to_string(),
                    line: node.start_position().row + 1,
                    fields,
                },
            );
        }
    }
    let mut cur = node.walk();
    if cur.goto_first_child() {
        loop {
            walk_java(cur.node(), source, file, graph);
            if !cur.goto_next_sibling() {
                break;
            }
        }
    }
}

fn extract_java_field(
    field: tree_sitter::Node,
    source: &str,
    out: &mut Vec<ModelField>,
) {
    let text = field.utf8_text(source.as_bytes()).unwrap_or("");
    let kind = if text.contains("@OneToMany") {
        FieldKind::OneToMany
    } else if text.contains("@ManyToMany") {
        FieldKind::ManyToMany
    } else if text.contains("@ManyToOne") {
        FieldKind::ForeignKey
    } else if text.contains("@OneToOne") {
        FieldKind::OneToOne
    } else {
        FieldKind::Scalar
    };
    // Extract variable name from declarator.
    let mut cur = field.walk();
    let mut name = String::new();
    if cur.goto_first_child() {
        loop {
            let n = cur.node();
            if n.kind() == "variable_declarator" {
                if let Some(id) = n.child_by_field_name("name") {
                    if let Ok(t) = id.utf8_text(source.as_bytes()) {
                        name = t.to_string();
                        break;
                    }
                }
            }
            if !cur.goto_next_sibling() {
                break;
            }
        }
    }
    if name.is_empty() {
        return;
    }
    out.push(ModelField {
        name,
        kind,
        target: None,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// RAII guard: deletes the temp file when dropped so test scans
    /// never persist after `cargo test` completes.
    struct TmpFile(std::path::PathBuf);
    impl TmpFile {
        fn new(name: &str, content: &str) -> Self {
            let pid = std::process::id();
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.subsec_nanos())
                .unwrap_or(0);
            let mut path = std::env::temp_dir();
            path.push(format!("drift-mg-{pid}-{nanos}-{name}"));
            let mut f = std::fs::File::create(&path).unwrap();
            f.write_all(content.as_bytes()).unwrap();
            Self(path)
        }
    }
    impl Drop for TmpFile {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }
    impl AsRef<std::path::Path> for TmpFile {
        fn as_ref(&self) -> &std::path::Path {
            &self.0
        }
    }

    #[test]
    fn detects_django_m2m_field() {
        let src = r#"from django.db import models
class User(models.Model):
    name = models.CharField(max_length=120)
    groups = models.ManyToManyField('Group')
"#;
        let t = TmpFile::new("django_m2m.py", src);
        let g = ModelGraph::build(&[t.0.clone()]);
        assert!(g.is_collection_field("User", "groups"));
        assert!(!g.is_collection_field("User", "name"));
    }

    #[test]
    fn detects_jpa_onetomany() {
        let src = "@Entity\nclass User {\n  @OneToMany(mappedBy=\"user\") List<Post> posts;\n  String name;\n}\n";
        let t = TmpFile::new("jpa_otm.java", src);
        let g = ModelGraph::build(&[t.0.clone()]);
        assert!(g.is_collection_field("User", "posts"));
        assert!(!g.is_collection_field("User", "name"));
    }

    #[test]
    fn target_of_returns_fk_target() {
        let src = r#"from django.db import models
class Post(models.Model):
    author = models.ForeignKey('User', on_delete=models.CASCADE)
"#;
        let t = TmpFile::new("django_fk.py", src);
        let g = ModelGraph::build(&[t.0.clone()]);
        assert_eq!(g.target_of("Post", "author"), Some("User"));
    }
}
