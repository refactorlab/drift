//! pr_quality::source_scan — byte-level line classifier (scc/tokei model).
//!
//! A regex-only classifier (cloc) miscounts `//` inside a string literal,
//! so we run a small **state machine** instead (PR_QUALITY_RESEARCH §8):
//! code / comment / blank, with strings suppressing comment tokens, nested
//! block comments, and longest-delimiter-first matching. All per-language
//! delimiters live in the `comment_syntax` DATA table — the scanner stays
//! language-agnostic (clean-architecture rule).
//!
//! Powers three comprehensibility/longevity signals, each scanned ONLY
//! over the right span class (the highest-leverage false-positive cut):
//! - **comment density** (SonarQube `comment_lines_density`, significant only),
//! - **magic numbers** (S109; scanned over CODE spans only; `{-1,0,1}` +
//!   const-declaration RHS exempt; identifier-boundary guarded),
//! - **TODO/SATD markers** (scanned over COMMENT spans only).
//!
//! Source is read defensively (path-escape guarded, size-capped), mirroring
//! `code_suggestions::read_around`. `None`/unreadable degrades gracefully.

use crate::pr_algorithms::constants::{comment_syntax_for, CommentSyntax};
use regex::Regex;
use std::path::Path;
use std::sync::OnceLock;

/// Per-file text statistics from one classifier pass.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct FileTextStats {
    pub code_lines: usize,
    pub comment_lines: usize,
    pub blank_lines: usize,
    /// Comment lines with ≥1 alphanumeric after stripping delimiters
    /// (SonarQube's "significant" rule — banner/`*`/empty comments = +0).
    pub significant_comment_lines: usize,
    pub numeric_literals: usize,
    pub magic_literals: usize,
    pub todo_markers: usize,
    pub bytes: usize,
}

impl FileTextStats {
    /// SonarQube `comment_lines_density = comments / (ncloc + comments)`.
    pub fn comment_density(&self) -> f64 {
        let denom = self.code_lines + self.significant_comment_lines;
        if denom == 0 {
            0.0
        } else {
            self.significant_comment_lines as f64 / denom as f64
        }
    }

    /// magic-literal / numeric-literal ratio (S109 budget input).
    pub fn magic_ratio(&self) -> f64 {
        if self.numeric_literals == 0 {
            0.0
        } else {
            self.magic_literals as f64 / self.numeric_literals as f64
        }
    }

    pub fn add(&mut self, other: &FileTextStats) {
        self.code_lines += other.code_lines;
        self.comment_lines += other.comment_lines;
        self.blank_lines += other.blank_lines;
        self.significant_comment_lines += other.significant_comment_lines;
        self.numeric_literals += other.numeric_literals;
        self.magic_literals += other.magic_literals;
        self.todo_markers += other.todo_markers;
        self.bytes += other.bytes;
    }
}

/// Map a path to a language key for `comment_syntax_for` (mirrors
/// `tech_debt::language_of`).
pub fn language_of(path: &str) -> &'static str {
    let l = path.to_lowercase();
    if l.ends_with(".py") {
        "python"
    } else if l.ends_with(".go") {
        "go"
    } else if l.ends_with(".tsx") || l.ends_with(".ts") {
        "typescript"
    } else if l.ends_with(".jsx") || l.ends_with(".js") || l.ends_with(".mjs") || l.ends_with(".cjs") {
        "javascript"
    } else if l.ends_with(".java") {
        "java"
    } else if l.ends_with(".rs") {
        "rust"
    } else if l.ends_with(".scala") || l.ends_with(".sc") {
        "scala"
    } else if l.ends_with(".kt") || l.ends_with(".kts") {
        "kotlin"
    } else {
        "unknown"
    }
}

/// Max bytes we'll read for a single file (I/O DoS bound, mirrors the
/// `walker` size-gate discipline). Larger files are skipped (→ `None`).
const MAX_FILE_BYTES: u64 = 1024 * 1024;

/// Read + classify a changed file at HEAD (defensive: path-escape guard +
/// size cap). Returns `None` when `repo_root` is absent, the path escapes
/// the root, the file is unreadable/binary, or it exceeds the size cap.
pub fn scan_file(repo_root: Option<&Path>, file_rel: &str) -> Option<FileTextStats> {
    let root = repo_root?;
    if file_rel.is_empty() {
        return None;
    }
    let path = root.join(file_rel);
    let canonical_root = root.canonicalize().ok()?;
    let canonical_path = path.canonicalize().ok()?;
    if !canonical_path.starts_with(&canonical_root) {
        return None; // path escape
    }
    let meta = std::fs::metadata(&canonical_path).ok()?;
    if meta.len() > MAX_FILE_BYTES {
        return None;
    }
    let text = std::fs::read_to_string(&canonical_path).ok()?; // Err on non-UTF-8 → skip
    Some(scan_text(&text, language_of(file_rel)))
}

#[derive(Clone)]
enum Carry {
    None,
    /// Inside a block comment (depth ≥ 1 for nested grammars).
    Block(usize),
    /// Inside a string literal.
    Str { close: String, raw: bool },
}

#[derive(PartialEq)]
enum Class {
    Blank,
    Code,
    Comment,
}

/// The core, disk-free, language-agnostic classifier. Carries block-comment
/// depth + open-string state ACROSS lines. `language = "unknown"` (no table)
/// degrades to blank-vs-code only.
pub fn scan_text(text: &str, language: &str) -> FileTextStats {
    let syntax = comment_syntax_for(language);
    let mut stats = FileTextStats {
        bytes: text.len(),
        ..Default::default()
    };
    let mut carry = Carry::None;

    // `str::lines()` splits on \n, strips \r, and (crucially) does NOT
    // yield a phantom trailing empty line for a file ending in '\n'.
    for line in text.lines() {
        let (class, code_part, comment_part) = classify_line(&mut carry, line, syntax);
        match class {
            Class::Code => stats.code_lines += 1,
            Class::Comment => {
                stats.comment_lines += 1;
                if is_significant_comment(&comment_part) {
                    stats.significant_comment_lines += 1;
                }
            }
            Class::Blank => stats.blank_lines += 1,
        }
        if !code_part.trim().is_empty() {
            let (n_num, n_magic) = scan_numeric(&code_part);
            stats.numeric_literals += n_num;
            stats.magic_literals += n_magic;
        }
        if !comment_part.is_empty() {
            stats.todo_markers += count_todo(&comment_part);
        }
    }
    stats
}

/// Classify one physical line, advancing `carry`. Returns (class, code
/// portion, comment portion). Code-then-comment counts as CODE (scc rule);
/// a blank line inside a block comment counts as COMMENT.
fn classify_line(
    carry: &mut Carry,
    line: &str,
    syntax: Option<&'static CommentSyntax>,
) -> (Class, String, String) {
    let mut code = String::new();
    let mut comment = String::new();
    let mut has_code = false;
    let mut has_comment = false;

    // Carry-in effect: a continued block comment / string colors the line
    // even if it has no fresh tokens.
    match carry {
        Carry::Block(_) => has_comment = true,
        Carry::Str { .. } => has_code = true,
        Carry::None => {}
    }

    let Some(sx) = syntax else {
        // No delimiter table → blank vs code only.
        return if line.trim().is_empty() {
            (Class::Blank, code, comment)
        } else {
            (Class::Code, line.to_string(), comment)
        };
    };

    // Delimiters, longest-first within each category (so `r#"`/`"""` win).
    use std::cmp::Reverse;
    let mut strs: Vec<&_> = sx.strings.iter().collect();
    strs.sort_by_key(|s| Reverse(s.open.len()));
    let mut blocks: Vec<&_> = sx.block.iter().collect();
    blocks.sort_by_key(|b| Reverse(b.open.len()));
    let mut lines: Vec<&String> = sx.line.iter().collect();
    lines.sort_by_key(|l| Reverse(l.len()));

    let mut i = 0usize;
    while i < line.len() {
        match carry.clone() {
            Carry::Str { close, raw } => {
                // Consume the string region until the close delim or EOL.
                // String INTERIOR is excluded from `code` (the numeric-scan
                // buffer) so `"port 8080"` doesn't count `8080` as a magic
                // number — a single space placeholder preserves boundaries.
                while i < line.len() {
                    let ch = line[i..].chars().next().unwrap();
                    if !raw && ch == '\\' {
                        i += ch.len_utf8();
                        if i < line.len() {
                            i += line[i..].chars().next().unwrap().len_utf8();
                        }
                        continue;
                    }
                    if line[i..].starts_with(close.as_str()) {
                        i += close.len();
                        *carry = Carry::None;
                        code.push(' ');
                        break;
                    }
                    i += ch.len_utf8();
                }
                has_code = true;
            }
            Carry::Block(depth) => {
                let mut depth = depth;
                while i < line.len() {
                    // close first (so an empty `/**/` closes)
                    if let Some(b) = blocks.iter().find(|b| line[i..].starts_with(b.close.as_str())) {
                        comment.push_str(&b.close);
                        i += b.close.len();
                        depth -= 1;
                        *carry = if depth == 0 { Carry::None } else { Carry::Block(depth) };
                        break;
                    }
                    // nested open
                    if sx.nested_block {
                        if let Some(b) = blocks.iter().find(|b| line[i..].starts_with(b.open.as_str())) {
                            comment.push_str(&b.open);
                            i += b.open.len();
                            depth += 1;
                            *carry = Carry::Block(depth);
                            continue;
                        }
                    }
                    let ch = line[i..].chars().next().unwrap();
                    comment.push(ch);
                    i += ch.len_utf8();
                }
                has_comment = true;
            }
            Carry::None => {
                let rest = &line[i..];
                // string opener? (interior excluded from the numeric-scan buffer)
                if let Some(s) = strs.iter().find(|s| rest.starts_with(s.open.as_str())) {
                    i += s.open.len();
                    *carry = Carry::Str {
                        close: s.close.clone(),
                        raw: s.raw,
                    };
                    has_code = true;
                    continue;
                }
                // block-comment opener?
                if let Some(b) = blocks.iter().find(|b| rest.starts_with(b.open.as_str())) {
                    comment.push_str(&b.open);
                    i += b.open.len();
                    *carry = Carry::Block(1);
                    has_comment = true;
                    continue;
                }
                // line comment? (rest of the line is comment)
                if lines.iter().any(|lc| rest.starts_with(lc.as_str())) {
                    comment.push_str(rest);
                    has_comment = true;
                    break;
                }
                // ordinary char
                let ch = rest.chars().next().unwrap();
                if !ch.is_whitespace() {
                    has_code = true;
                }
                code.push(ch);
                i += ch.len_utf8();
            }
        }
    }

    let class = if has_code {
        Class::Code
    } else if has_comment {
        Class::Comment
    } else {
        Class::Blank
    };
    (class, code, comment)
}

/// A comment line is "significant" iff stripping comment punctuation
/// (`/ * # - "` and whitespace) leaves ≥1 alphanumeric char.
fn is_significant_comment(comment: &str) -> bool {
    comment
        .chars()
        .any(|c| c.is_alphanumeric())
}

fn numeric_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(
            r"(?ix)
            ( 0x[0-9a-f][0-9a-f_]*
            | 0o[0-7][0-7_]*
            | 0b[01][01_]*
            | \d[\d_]*\.\d[\d_]*(?:e[+-]?\d+)?
            | \.\d[\d_]*(?:e[+-]?\d+)?
            | \d[\d_]*(?:e[+-]?\d+)? )",
        )
        .expect("numeric literal regex")
    })
}

fn const_decl_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    // A literal on the RHS of a named constant is the *fix*, not a magic
    // number (S109). Detect const-declaration lines lexically.
    R.get_or_init(|| {
        Regex::new(r"(?i)\b(const|final|static|val|enum|let)\b|^[^=]*\b[A-Z][A-Z0-9_]{2,}\s*[:=]")
            .expect("const decl regex")
    })
}

fn todo_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    // Case-sensitive uppercase SATD markers (developers write these caps);
    // cuts prose false positives.
    R.get_or_init(|| Regex::new(r"\b(TODO|FIXME|HACK|XXX)\b").expect("todo regex"))
}

fn is_ident_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// Count numeric / magic literals in a CODE-classified line span.
/// Magic = a literal NOT exempt (`{0,1,-1}`) and NOT on a const-decl line,
/// with identifier-boundary guards (so `8` in `utf8`, `256` in `sha256`
/// are not matched).
fn scan_numeric(code: &str) -> (usize, usize) {
    let is_const = const_decl_re().is_match(code);
    let mut total = 0usize;
    let mut magic = 0usize;
    for m in numeric_re().find_iter(code) {
        let (start, end) = (m.start(), m.end());
        // left boundary: not preceded by an identifier char or '.'
        let before = code[..start].chars().last();
        if before.map(|c| is_ident_char(c) || c == '.').unwrap_or(false) {
            continue;
        }
        // right boundary: not followed by an identifier char
        let after = code[end..].chars().next();
        if after.map(is_ident_char).unwrap_or(false) {
            continue;
        }
        total += 1;
        if is_const {
            continue; // RHS of a named constant → not magic
        }
        let lit = &code[start..end];
        if is_exempt_literal(lit, before) {
            continue;
        }
        magic += 1;
    }
    (total, magic)
}

/// Exempt `{0, 1, -1}` (S109 default exempt set; `-1` when preceded by `-`).
fn is_exempt_literal(lit: &str, before: Option<char>) -> bool {
    let cleaned: String = lit.chars().filter(|c| *c != '_').collect();
    if let Ok(v) = cleaned.parse::<f64>() {
        if v == 0.0 || v == 1.0 {
            // 1 preceded by '-' is -1 → still exempt; 1/0 exempt outright.
            return true;
        }
    }
    // hex/oct/bin 0 or 1
    matches!(cleaned.as_str(), "0x0" | "0x1" | "0b0" | "0b1" | "0o0" | "0o1")
        || (before == Some('-') && cleaned == "1")
}

fn count_todo(comment: &str) -> usize {
    todo_re().find_iter(comment).count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_code_comment_blank_python() {
        let src = "x = 1  # inline\n# pure comment\n\nprint(x)\n";
        let s = scan_text(src, "python");
        assert_eq!(s.code_lines, 2, "x=1 (code+trailing comment) + print"); // code-then-comment = code
        assert_eq!(s.comment_lines, 1);
        assert_eq!(s.blank_lines, 1);
    }

    #[test]
    fn comment_marker_inside_string_is_not_a_comment() {
        // The `//` lives inside a string → the line is CODE, not comment.
        let src = "let url = \"http://example.com\";\n";
        let s = scan_text(src, "rust");
        assert_eq!(s.comment_lines, 0, "// inside a string must not count as comment");
        assert_eq!(s.code_lines, 1);
    }

    #[test]
    fn block_comment_spans_lines_and_blank_inside_is_comment() {
        let src = "code();\n/* line one\n\n   line three */\nmore();\n";
        let s = scan_text(src, "javascript");
        assert_eq!(s.code_lines, 2, "code() + more()");
        assert_eq!(s.comment_lines, 3, "the 3 block lines incl. the blank one");
    }

    #[test]
    fn nested_block_comment_rust() {
        let src = "a();\n/* outer /* inner */ still outer */\nb();\n";
        let s = scan_text(src, "rust");
        assert_eq!(s.code_lines, 2);
        assert_eq!(s.comment_lines, 1);
    }

    #[test]
    fn magic_numbers_respect_exempt_and_const_and_identifiers() {
        // 0,1 exempt; 0.73 magic; `sha256`/`utf8` digits NOT matched.
        let s1 = scan_text("if (x > 0.73) { return 1; }\n", "javascript");
        assert_eq!(s1.magic_literals, 1, "0.73 is magic, 1 is exempt: {s1:?}");

        // const RHS is the fix, not magic.
        let s2 = scan_text("const TIMEOUT = 5000;\n", "javascript");
        assert_eq!(s2.magic_literals, 0, "named constant RHS is not magic: {s2:?}");

        // digits inside identifiers are not literals.
        let s3 = scan_text("hash = sha256(utf8_encode(x));\n", "javascript");
        assert_eq!(s3.numeric_literals, 0, "sha256/utf8 digits are not literals: {s3:?}");
    }

    #[test]
    fn numbers_in_strings_and_comments_are_not_magic() {
        let s = scan_text("msg = \"port 8080\";  // retry after 30 seconds\n", "javascript");
        assert_eq!(s.numeric_literals, 0, "8080 in string + 30 in comment must not count: {s:?}");
    }

    #[test]
    fn todo_markers_only_in_comments() {
        let src = "// TODO: fix this\nx = \"TODO not counted in string\";\nfn handle() {} // FIXME later\n";
        let s = scan_text(src, "rust");
        assert_eq!(s.todo_markers, 2, "TODO + FIXME in comments; string TODO ignored: {s:?}");
    }

    #[test]
    fn comment_density_significant_only() {
        // 2 code, 1 significant comment, 1 banner (non-significant) comment.
        let src = "fn a() {}\nfn b() {}\n// real explanation\n//****\n";
        let s = scan_text(src, "rust");
        assert_eq!(s.code_lines, 2);
        assert_eq!(s.comment_lines, 2);
        assert_eq!(s.significant_comment_lines, 1, "banner //**** is not significant");
        // density = 1 / (2 + 1) = 0.333
        assert!((s.comment_density() - 1.0 / 3.0).abs() < 1e-9);
    }

    #[test]
    fn go_raw_string_backtick_suppresses_comments() {
        let src = "s := `a // not a comment`\n";
        let s = scan_text(src, "go");
        assert_eq!(s.comment_lines, 0);
        assert_eq!(s.code_lines, 1);
    }

    #[test]
    fn unknown_language_degrades_to_blank_vs_code() {
        let s = scan_text("anything here\n\n", "unknown");
        assert_eq!(s.code_lines, 1);
        assert_eq!(s.blank_lines, 1);
        assert_eq!(s.comment_lines, 0);
    }

    #[test]
    fn empty_and_whitespace_safe() {
        let s = scan_text("", "rust");
        assert_eq!(s, FileTextStats::default());
        let s2 = scan_text("   \n\t\n", "rust");
        assert_eq!(s2.blank_lines, 2);
    }
}
