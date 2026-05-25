//! Where the `drift` binary should land and how it should get there.
//!
//! Pure data — the actual filesystem / registry work happens in
//! `infra::*Installer`. Splitting `scope` from `strategy` lets a single
//! adapter (e.g. `MacOsCliInstaller`) pick the right combination at
//! runtime based on which dirs are writable, then describe the choice
//! back in this struct for logging / Settings UI display.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// Whether the install touches a user-owned directory (no sudo) or a
/// system-wide one. Drives both the install attempt itself and the
/// "Installed for: user / all users" line the Settings UI shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallScope {
    User,
    System,
}

/// Mechanism the adapter uses to put `drift` on PATH.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallStrategy {
    /// Symlink the bundle's binary into the destination. Auto-update
    /// flows through for free because the link target inside the
    /// bundle is replaced atomically by the updater.
    Symlink,
    /// Copy the binary to the destination. Used when the bundle path
    /// is transient (AppImage mount). Verify pass compares hashes so
    /// auto-updates trigger a re-copy.
    Copy,
    /// Add the binary's directory to the user's PATH (Windows). The
    /// binary itself stays inside the install dir.
    PathEntry,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallTarget {
    /// For [`InstallStrategy::Symlink`] / [`Copy`]: the absolute path the
    /// `drift` command will live at. For [`InstallStrategy::PathEntry`]:
    /// the directory added to PATH.
    pub dest: PathBuf,
    pub scope: InstallScope,
    pub strategy: InstallStrategy,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_roundtrips_through_json() {
        let t = InstallTarget {
            dest: PathBuf::from("/Users/ilyas/.local/bin/drift"),
            scope: InstallScope::User,
            strategy: InstallStrategy::Symlink,
        };
        let s = serde_json::to_string(&t).unwrap();
        assert!(s.contains("\"scope\":\"user\""));
        assert!(s.contains("\"strategy\":\"symlink\""));
        let back: InstallTarget = serde_json::from_str(&s).unwrap();
        assert_eq!(t, back);
    }
}
