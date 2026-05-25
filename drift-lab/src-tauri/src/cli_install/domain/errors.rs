//! Errors the install-plane use cases can return.
//!
//! Distinguishes platform-mechanical failures (`Io`, `PermissionDenied`)
//! from semantic ones (`DestinationConflict`, `UnsupportedPlatform`) so
//! the Settings UI can branch on the variant when rendering messages.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum InstallError {
    /// Filesystem or process-spawning failure. The string is intended
    /// for human display, not parsing.
    #[error("install I/O: {0}")]
    Io(String),

    /// The bundle's `drift` binary isn't where we expected. Happens in
    /// dev builds when the binary hasn't been built yet; in release
    /// builds it would indicate the bundler dropped it.
    #[error("bundle binary not found at {path}")]
    BundleBinaryMissing { path: String },

    /// `which drift` already resolves to a binary that isn't ours
    /// (Homebrew has unrelated tools named `drift`, etc.). The
    /// installer refuses to overwrite — the Settings UI shows the
    /// conflicting path so the user can decide.
    #[error("destination conflicts with non-drift binary at {path}")]
    DestinationConflict { path: String },

    /// We don't know how to install on this OS. The Settings UI shows
    /// a generic "manually copy the binary from {bundle path}" hint.
    #[error("unsupported platform: {0}")]
    UnsupportedPlatform(String),

    /// Adapter tried to write to a path it doesn't have permission for.
    /// Distinct from `Io` so the UI can render a sudo / write-perm hint.
    #[error("permission denied at {path}: {reason}")]
    PermissionDenied { path: String, reason: String },
}
