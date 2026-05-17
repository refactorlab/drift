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
// Don't bake real scan reports into the binary. `fixtures/scans/` is the
// viewer's *runtime* URL space — the HTTP server rewrites those paths to
// read from `~/.drift/scans/` at request time. If a developer drops a real
// scan into `viewer/dist/fixtures/scans/` (e.g. while debugging), the
// rust-embed derive macro would otherwise read every byte at compile time
// and emit it as a `const &[u8]` literal, turning drift-lab into a
// gigabyte-class compile. Exclude the directory entirely.
#[exclude = "fixtures/scans/*"]
pub struct ViewerAssets;
