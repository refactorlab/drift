//! Pure types for the CLI-install subsystem.
//!
//! Cardinal rule: no item here — direct or transitive in signatures —
//! may name a type from `tauri`, `tokio::process`, `std::os::*`,
//! `std::process`, `std::fs`, or `winreg`. Lift any I/O behind a port.
//!
//! Types here describe the *plan* (what we want to do) and the
//! *outcome* (what happened). They are cross-platform; platform
//! differences hide behind `ports::CliInstaller` implementations.

mod errors;
mod install_outcome;
mod install_plan;
mod install_target;

pub use errors::InstallError;
pub use install_outcome::InstallOutcome;
pub use install_plan::{InstallPlan, ShellRcHint};
pub use install_target::{InstallScope, InstallStrategy, InstallTarget};
