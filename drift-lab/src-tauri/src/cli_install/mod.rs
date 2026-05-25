//! CLI installer — bundles a `drift` binary inside the desktop release
//! and puts it on the user's `PATH` automatically.
//!
//! Why a separate bounded context (not part of `control/`): install is a
//! one-time setup concern triggered at app launch, with platform-specific
//! adapters that change for different reasons than the control plane.
//! Common Closure Principle says they don't belong in the same module.
//!
//! Layered per "Clean Architecture" — dependencies point inward:
//!
//! ```text
//!   lib.rs::setup()        ──►  app (use cases)  ──►  ports (traits)  ◄──  infra (adapters)
//!   Tauri command shims    ──►                                  ▲
//!                                                               │
//!                                                          domain (pure types)
//! ```
//!
//! Platform behaviour summary (resolved by `infra::platform_installer()`):
//!
//! | Platform | Bundle path of `drift`             | Install destination          | Strategy |
//! |----------|-----------------------------------|------------------------------|----------|
//! | macOS    | `Drift Lab.app/Contents/Resources` | `/usr/local/bin` or `~/.local/bin` | symlink |
//! | Linux deb| `/usr/lib/drift-lab/resources/`    | `/usr/local/bin` (postinst)  | symlink (postinst) + runtime fallback |
//! | AppImage | `<mount>/usr/lib/drift-lab/...`    | `~/.local/bin`               | copy (mount point is transient) |
//! | Windows  | `C:\Program Files\Drift Lab\...`   | user `PATH` registry entry   | PATH entry |
//!
//! * [`domain`] — pure types. Cardinal rule: no `tauri`, `tokio::process`,
//!   `std::os::*`, `std::process`, `std::fs`, or `winreg` may appear.
//! * [`ports`] — traits. Same cardinal rule.
//! * [`app`] — use cases. One verb per file. No I/O imports.
//! * [`infra`] — adapters. The only place process spawning, symlinks,
//!   registry edits, and `xattr` invocations live.

pub mod app;
pub mod domain;
pub mod infra;
pub mod ports;
