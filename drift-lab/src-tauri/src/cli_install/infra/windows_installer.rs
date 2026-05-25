//! Windows installer.
//!
//! Stubbed for now — Windows bundles are disabled in CI (see
//! `.github/workflows/drift-lab-desktop-release.yml`). When Windows
//! release ships, replace this with a registry-based PATH editor.
//! Returns `Skipped` so the lib.rs wiring stays clean.

#![cfg(windows)]

use std::path::{Path, PathBuf};

use crate::cli_install::domain::{InstallError, InstallOutcome};
use crate::cli_install::ports::CliInstaller;

pub struct WindowsCliInstaller;

impl WindowsCliInstaller {
    pub fn from_env() -> Result<Self, InstallError> {
        Ok(Self)
    }
}

impl CliInstaller for WindowsCliInstaller {
    fn ensure(&self, _source: &Path) -> Result<InstallOutcome, InstallError> {
        Ok(InstallOutcome::Skipped {
            reason: "Windows installer not yet implemented".into(),
        })
    }

    fn install_path(&self) -> PathBuf {
        PathBuf::new()
    }
}
