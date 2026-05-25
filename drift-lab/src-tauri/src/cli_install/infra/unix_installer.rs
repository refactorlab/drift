//! Unix installer — symlinks `<source>` to `~/.local/bin/drift`.
//!
//! Works for both macOS and Linux. The destination is user-owned
//! (`$HOME/.local/bin`) so the install requires no sudo. On macOS this
//! falls back to the same dir; if the user wants `/usr/local/bin`,
//! they're free to `ln -s` it themselves — we don't escalate.
//!
//! AppImage caveat: the source path inside the squashfs mount changes
//! every run. We accept that — `ensure()` is idempotent so the next
//! launch updates the symlink to the new mount-point. The Settings UI
//! never asserts the OLD path is still on disk.
//!
//! PATH detection: macOS default zsh does NOT include `~/.local/bin`
//! in `PATH`. If we symlink there and stop, `drift --help` fails with
//! `command not found` and the user has no idea why. After a
//! successful symlink, we inspect `$PATH`: if the dest dir is missing
//! we upgrade the outcome to [`InstallOutcome::NeedsManualAction`]
//! with a paste-ready shell-rc snippet. The Settings UI / Tauri log
//! renders this so the user sees clear instructions instead of
//! silent breakage.

#![cfg(unix)]

use std::path::{Path, PathBuf};

use crate::cli_install::domain::{InstallError, InstallOutcome};
use crate::cli_install::ports::CliInstaller;

pub struct UnixCliInstaller {
    /// Destination path (`$HOME/.local/bin/drift`).
    dest: PathBuf,
    /// Captured `$PATH` at construction. Stored (not re-read on every
    /// `ensure()`) so tests can inject deterministic values without
    /// racing against the process-global env.
    path_env: String,
    /// Where to tell the user to paste the export line when the dest
    /// isn't on PATH. Inferred from `$SHELL`.
    shell: ShellHint,
}

#[derive(Clone)]
struct ShellHint {
    /// Absolute path to the user's shell rc (e.g. `~/.zshrc`).
    rc_path: PathBuf,
    /// Human-readable shell name for the message ("zsh", "bash", "your shell").
    name: String,
}

impl ShellHint {
    fn from_env(home: &Path) -> Self {
        let shell = std::env::var("SHELL").unwrap_or_default();
        if shell.ends_with("/zsh") {
            Self { rc_path: home.join(".zshrc"), name: "zsh".into() }
        } else if shell.ends_with("/bash") {
            // ~/.bashrc is what interactive non-login shells read on
            // most distros; ~/.bash_profile is login-only. The user
            // probably wants the snippet in .bashrc — login or not,
            // .bash_profile typically sources .bashrc anyway.
            Self { rc_path: home.join(".bashrc"), name: "bash".into() }
        } else {
            // POSIX fallback. ~/.profile is read by login shells of
            // every flavour we care about.
            Self { rc_path: home.join(".profile"), name: "your shell".into() }
        }
    }
}

impl UnixCliInstaller {
    /// Production constructor. Reads `$HOME`, `$PATH`, and `$SHELL`.
    /// Errors only if `$HOME` is unset (would indicate a hostile env).
    pub fn from_env() -> Result<Self, InstallError> {
        let home_os = std::env::var_os("HOME")
            .ok_or_else(|| InstallError::Io("$HOME is not set".into()))?;
        let home = PathBuf::from(home_os);
        let dest = home.join(".local").join("bin").join("drift");
        let path_env = std::env::var("PATH").unwrap_or_default();
        let shell = ShellHint::from_env(&home);
        Ok(Self { dest, path_env, shell })
    }

    /// Test constructor: dest's parent is treated as ON PATH. Existing
    /// tests keep exercising the symlink-creation logic unchanged.
    #[cfg(test)]
    pub fn with_dest(dest: PathBuf) -> Self {
        let parent = dest
            .parent()
            .map(|p| p.display().to_string())
            .unwrap_or_default();
        Self {
            dest,
            path_env: parent,
            shell: ShellHint {
                rc_path: PathBuf::from("/test/.zshrc"),
                name: "zsh".into(),
            },
        }
    }

    /// Test constructor: dest's parent is NOT on PATH. Used by the
    /// NeedsManualAction tests.
    #[cfg(test)]
    pub fn with_dest_off_path(dest: PathBuf) -> Self {
        Self {
            dest,
            // Plausible PATH that doesn't include the test dest's parent.
            path_env: "/usr/bin:/bin".into(),
            shell: ShellHint {
                rc_path: PathBuf::from("/test/.zshrc"),
                name: "zsh".into(),
            },
        }
    }

    /// True iff the dest's parent directory appears as a literal entry
    /// in `$PATH`. We deliberately don't expand `~` or follow symlinks
    /// here — `PATH` is a string the user composed, not a resolved tree;
    /// matching string-by-string keeps the test honest with what the
    /// shell will actually look up.
    fn dest_on_path(&self) -> bool {
        let Some(dest_dir) = self.dest.parent() else {
            return false;
        };
        self.path_env
            .split(':')
            .any(|p| !p.is_empty() && Path::new(p) == dest_dir)
    }

    /// Build the NeedsManualAction payload (reason + paste-ready
    /// instructions). Kept here so tests can assert on its content
    /// without recreating the format string.
    fn needs_manual_action(&self) -> InstallOutcome {
        let dest_dir = self
            .dest
            .parent()
            .map(|p| p.display().to_string())
            .unwrap_or_default();
        let rc = self.shell.rc_path.display();
        let shell_name = &self.shell.name;
        let instructions = format!(
            "drift was installed at {dest} but {dest_dir} isn't on your PATH yet.\n\
             \n\
             Add this line to your {shell_name} startup file ({rc}):\n\
             \n  export PATH=\"{dest_dir}:$PATH\"\n\n\
             Then restart your terminal (or run `source {rc}`) and `drift --help` will work.",
            dest = self.dest.display(),
        );
        InstallOutcome::NeedsManualAction {
            target: self.dest.clone(),
            reason: format!("{dest_dir} is not on PATH"),
            instructions,
        }
    }
}

impl CliInstaller for UnixCliInstaller {
    fn ensure(&self, source: &Path) -> Result<InstallOutcome, InstallError> {
        if !source.exists() {
            return Err(InstallError::BundleBinaryMissing {
                path: source.display().to_string(),
            });
        }

        // If the link already resolves to our `source`, the filesystem
        // half is done — but we still need to check PATH below.
        let mut symlink_outcome = None;
        if let Ok(existing) = std::fs::read_link(&self.dest) {
            if same_path(&existing, source) {
                symlink_outcome = Some(InstallOutcome::AlreadyInstalled {
                    target: self.dest.clone(),
                });
            }
            // else: stale symlink (points elsewhere). Replace it.
        } else if self.dest.exists() {
            return Err(InstallError::DestinationConflict {
                path: self.dest.display().to_string(),
            });
        }

        if symlink_outcome.is_none() {
            if let Some(parent) = self.dest.parent() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    InstallError::Io(format!("create {}: {e}", parent.display()))
                })?;
            }
            // Remove any existing stale symlink (verified non-conflicting above).
            let _ = std::fs::remove_file(&self.dest);
            std::os::unix::fs::symlink(source, &self.dest).map_err(|e| {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    InstallError::PermissionDenied {
                        path: self.dest.display().to_string(),
                        reason: e.to_string(),
                    }
                } else {
                    InstallError::Io(format!("symlink {}: {e}", self.dest.display()))
                }
            })?;
            symlink_outcome = Some(InstallOutcome::Installed {
                target: self.dest.clone(),
            });
        }

        // PATH check — symlink exists; report whether the user can
        // actually call `drift` from their shell yet.
        if self.dest_on_path() {
            Ok(symlink_outcome.expect("set above"))
        } else {
            Ok(self.needs_manual_action())
        }
    }

    fn install_path(&self) -> PathBuf {
        self.dest.clone()
    }
}

/// Compare two paths after canonicalising what we can. Symlinks can
/// resolve to slightly different string forms (`/tmp/x` vs.
/// `/private/tmp/x` on macOS) even when they point at the same inode;
/// we accept either form as equal.
fn same_path(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(ca), Ok(cb)) => ca == cb,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn fake_source(dir: &TempDir, name: &str) -> PathBuf {
        let path = dir.path().join(name);
        std::fs::write(&path, b"#!/bin/sh\necho hi\n").unwrap();
        use std::os::unix::fs::PermissionsExt;
        let mut perm = std::fs::metadata(&path).unwrap().permissions();
        perm.set_mode(0o755);
        std::fs::set_permissions(&path, perm).unwrap();
        path
    }

    // ── Symlink-creation tests (PATH-on assumed) ────────────────────────

    #[test]
    fn first_install_creates_symlink_and_returns_installed() {
        let dir = TempDir::new().unwrap();
        let source = fake_source(&dir, "drift_bundle");
        let dest = dir.path().join("bin").join("drift");
        let inst = UnixCliInstaller::with_dest(dest.clone());

        let out = inst.ensure(&source).expect("ensure ok");
        match out {
            InstallOutcome::Installed { target } => assert_eq!(target, dest),
            other => panic!("expected Installed, got {other:?}"),
        }
        let resolved = std::fs::read_link(&dest).expect("symlink present");
        assert_eq!(resolved, source);
    }

    #[test]
    fn second_install_returns_already_installed() {
        let dir = TempDir::new().unwrap();
        let source = fake_source(&dir, "drift_bundle");
        let dest = dir.path().join("bin").join("drift");
        let inst = UnixCliInstaller::with_dest(dest.clone());

        let _ = inst.ensure(&source).expect("first");
        let out = inst.ensure(&source).expect("second");
        assert!(matches!(out, InstallOutcome::AlreadyInstalled { .. }));
    }

    #[test]
    fn install_overwrites_stale_symlink_pointing_elsewhere() {
        let dir = TempDir::new().unwrap();
        let old_source = fake_source(&dir, "old_bundle");
        let new_source = fake_source(&dir, "new_bundle");
        let dest = dir.path().join("bin").join("drift");
        let inst = UnixCliInstaller::with_dest(dest.clone());

        std::fs::create_dir_all(dest.parent().unwrap()).unwrap();
        std::os::unix::fs::symlink(&old_source, &dest).unwrap();

        let out = inst.ensure(&new_source).expect("ensure");
        assert!(matches!(out, InstallOutcome::Installed { .. }));
        let resolved = std::fs::read_link(&dest).unwrap();
        assert_eq!(resolved, new_source);
    }

    #[test]
    fn refuses_to_overwrite_non_symlink_dest() {
        let dir = TempDir::new().unwrap();
        let source = fake_source(&dir, "drift_bundle");
        let dest = dir.path().join("bin").join("drift");
        let inst = UnixCliInstaller::with_dest(dest.clone());

        std::fs::create_dir_all(dest.parent().unwrap()).unwrap();
        std::fs::write(&dest, b"#!/bin/sh\n").unwrap();

        let err = inst.ensure(&source).expect_err("should refuse");
        match err {
            InstallError::DestinationConflict { .. } => {}
            other => panic!("expected DestinationConflict, got {other:?}"),
        }
    }

    #[test]
    fn missing_source_returns_bundle_missing_error() {
        let dir = TempDir::new().unwrap();
        let absent = dir.path().join("not-there");
        let dest = dir.path().join("drift");
        let inst = UnixCliInstaller::with_dest(dest);

        match inst.ensure(&absent) {
            Err(InstallError::BundleBinaryMissing { .. }) => {}
            other => panic!("expected BundleBinaryMissing, got {other:?}"),
        }
    }

    // ── PATH-detection tests ────────────────────────────────────────────

    #[test]
    fn install_returns_needs_manual_action_when_dest_not_on_path() {
        let dir = TempDir::new().unwrap();
        let source = fake_source(&dir, "drift_bundle");
        let dest = dir.path().join("bin").join("drift");
        let inst = UnixCliInstaller::with_dest_off_path(dest.clone());

        let out = inst.ensure(&source).expect("ensure ok");
        match out {
            InstallOutcome::NeedsManualAction {
                target,
                reason,
                instructions,
            } => {
                assert_eq!(target, dest);
                assert!(
                    reason.contains("not on PATH"),
                    "reason should mention PATH, got: {reason}"
                );
                // Instructions must include a paste-ready export line for
                // the dest's parent dir AND name the rc file.
                let parent = dest.parent().unwrap().display().to_string();
                assert!(
                    instructions.contains(&parent),
                    "instructions should reference {parent}, got: {instructions}"
                );
                assert!(
                    instructions.contains("export PATH"),
                    "instructions should include export line, got: {instructions}"
                );
                assert!(
                    instructions.contains(".zshrc"),
                    "instructions should name the rc file, got: {instructions}"
                );
            }
            other => panic!("expected NeedsManualAction, got {other:?}"),
        }
        // Filesystem half still happened — symlink must exist.
        assert!(std::fs::read_link(&dest).is_ok(), "symlink should still be created");
    }

    #[test]
    fn second_install_off_path_still_returns_needs_manual_action() {
        // Once installed but PATH never fixed → every subsequent
        // launch keeps reminding the user. The installer is
        // self-healing in BOTH dimensions (symlink + PATH check).
        let dir = TempDir::new().unwrap();
        let source = fake_source(&dir, "drift_bundle");
        let dest = dir.path().join("bin").join("drift");
        let inst = UnixCliInstaller::with_dest_off_path(dest.clone());

        let _ = inst.ensure(&source).expect("first");
        let out = inst.ensure(&source).expect("second");
        assert!(matches!(out, InstallOutcome::NeedsManualAction { .. }));
    }

    #[test]
    fn dest_on_path_handles_empty_and_trailing_separators() {
        // Hand-roll an installer to exercise dest_on_path directly with
        // pathological PATH values seen in the wild.
        let dest = PathBuf::from("/Users/x/.local/bin/drift");
        let mk = |p: &str| UnixCliInstaller {
            dest: dest.clone(),
            path_env: p.into(),
            shell: ShellHint {
                rc_path: PathBuf::from("/Users/x/.zshrc"),
                name: "zsh".into(),
            },
        };
        // Exact match.
        assert!(mk("/Users/x/.local/bin").dest_on_path());
        // Empty entries (leading colon) shouldn't match anything.
        assert!(!mk(":/usr/bin").dest_on_path());
        // Other dirs.
        assert!(!mk("/usr/bin:/bin").dest_on_path());
        // Multiple entries with the right one mixed in.
        assert!(mk("/usr/bin:/Users/x/.local/bin:/bin").dest_on_path());
    }
}
