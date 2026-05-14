//! Embed the built static-profiler viewer into the binary.
//!
//! `rust-embed` scans the folder at *compile time*. The `build.rs` ensures
//! the directory exists (even if empty) so a fresh clone without a viewer
//! build still compiles — the HTTP server then serves a stub index until
//! the user runs `npm run build`.
//!
//! Production builds: the user's CI pipeline is expected to run
//! `npm run build` inside `drift-static-profiler/viewer/` before
//! `cargo tauri build`, so the real bundle ends up baked into the binary.

use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../../drift-static-profiler/viewer/dist/"]
pub struct ViewerAssets;
