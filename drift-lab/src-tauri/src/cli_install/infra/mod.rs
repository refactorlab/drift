//! Infrastructure adapters — the only place I/O happens inside this
//! subsystem. Each file here implements one trait from
//! [`super::ports`] against a concrete external dependency (filesystem,
//! Windows registry, macOS `xattr`, Tauri resource resolver).
//!
//! The [`platform_installer`] factory selects the right adapter for
//! the current OS at compile time; use cases never see the choice.

#[cfg(unix)]
mod unix_installer;
#[cfg(windows)]
mod windows_installer;

use crate::cli_install::domain::InstallError;
use crate::cli_install::ports::CliInstaller;

/// Construct the right installer for the current OS. Cross-platform
/// extension point — adding a third OS means one new file + one match
/// arm here.
pub fn platform_installer() -> Result<Box<dyn CliInstaller>, InstallError> {
    #[cfg(unix)]
    {
        Ok(Box::new(unix_installer::UnixCliInstaller::from_env()?))
    }
    #[cfg(windows)]
    {
        Ok(Box::new(windows_installer::WindowsCliInstaller::from_env()?))
    }
    #[cfg(not(any(unix, windows)))]
    {
        Err(InstallError::UnsupportedPlatform(std::env::consts::OS.into()))
    }
}
