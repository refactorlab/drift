//! The single seam between the install use case and platform I/O.
//!
//! Cardinal rule: nothing here may name `tauri`, `std::os::*`,
//! `std::process`, `std::fs`, or `winreg`. Lift any I/O behind this
//! trait. The use case sees only `Path` + `PathBuf` (pure data).

use std::path::{Path, PathBuf};

use crate::cli_install::domain::{InstallError, InstallOutcome};

/// Cross-platform install operation. Implementations decide WHERE
/// (e.g. `~/.local/bin/drift`) and HOW (symlink, copy, PATH entry); the
/// use case only invokes `ensure(source)` and renders the outcome.
pub trait CliInstaller: Send + Sync {
    /// Make `source` reachable as `drift` on the user's PATH. Returns
    /// the variant of `InstallOutcome` that describes what happened —
    /// fresh install, already installed, or skipped with reason.
    ///
    /// Implementations MUST be idempotent: calling `ensure(source)`
    /// twice with the same `source` produces `AlreadyInstalled` the
    /// second time, not `Installed`.
    fn ensure(&self, source: &Path) -> Result<InstallOutcome, InstallError>;

    /// Where this installer would land the symlink / copy. Exposed so
    /// the Settings UI can show "drift CLI installed at: …" without
    /// re-running `ensure()`.
    fn install_path(&self) -> PathBuf;
}
