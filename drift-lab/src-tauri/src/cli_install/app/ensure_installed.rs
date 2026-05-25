//! The single install use case.
//!
//! Inputs: a [`CliInstaller`] (platform behaviour) and the path to the
//! `drift` binary inside the bundle. Output: an [`InstallOutcome`] the
//! caller renders / logs.
//!
//! Pure orchestration — no I/O imports beyond `Path`. The "what
//! platform are we on" decision lives at the composition root
//! (`crate::cli_install::infra::platform_installer`).

use std::path::Path;

use crate::cli_install::domain::{InstallError, InstallOutcome};
use crate::cli_install::ports::CliInstaller;

/// Run the install check exactly once. Idempotent at the installer
/// level — repeated calls return `AlreadyInstalled` after the first
/// success.
///
/// Errors propagate so the caller can log them. The wiring in
/// `lib.rs::setup` deliberately treats errors as non-fatal: a failed
/// install must not prevent the app from starting.
pub fn execute(
    installer: &dyn CliInstaller,
    source: &Path,
) -> Result<InstallOutcome, InstallError> {
    installer.ensure(source)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;

    /// Fake installer that records every `ensure()` call and returns a
    /// scripted outcome. Verifies the use case is a thin pass-through.
    struct RecordingInstaller {
        calls: Mutex<Vec<PathBuf>>,
        outcome: InstallOutcome,
    }
    impl CliInstaller for RecordingInstaller {
        fn ensure(&self, source: &Path) -> Result<InstallOutcome, InstallError> {
            self.calls.lock().unwrap().push(source.to_path_buf());
            Ok(self.outcome.clone())
        }
        fn install_path(&self) -> PathBuf {
            PathBuf::from("/fake/drift")
        }
    }

    #[test]
    fn execute_delegates_to_installer_with_source() {
        let inst = RecordingInstaller {
            calls: Mutex::new(Vec::new()),
            outcome: InstallOutcome::Installed { target: PathBuf::from("/x/drift") },
        };
        let src = PathBuf::from("/bundle/drift");
        let out = execute(&inst, &src).expect("ok");
        assert!(matches!(out, InstallOutcome::Installed { .. }));
        let calls = inst.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0], src);
    }

    #[test]
    fn execute_propagates_installer_error() {
        struct Failing;
        impl CliInstaller for Failing {
            fn ensure(&self, _: &Path) -> Result<InstallOutcome, InstallError> {
                Err(InstallError::Io("nope".into()))
            }
            fn install_path(&self) -> PathBuf {
                PathBuf::new()
            }
        }
        let res = execute(&Failing, &PathBuf::from("/x"));
        assert!(matches!(res, Err(InstallError::Io(_))));
    }
}
