use std::path::PathBuf;

/// Sentinel HTML marker emitted into the stub `index.html`. We grep for
/// this to tell a real Vite build apart from the placeholder this script
/// drops on a fresh clone. Real builds never contain this string.
const STUB_SENTINEL: &str = "<!-- drift-lab build.rs stub -->";

fn main() {
    // The bundled `drift` CLI resource (declared in tauri.conf.json
    // under bundle.resources) is built by `beforeBuildCommand` during
    // `cargo tauri build`. For plain `cargo check` / `cargo build` the
    // file doesn't exist yet, which trips tauri-build's resource
    // validation. Drop a minimal placeholder so compilation succeeds;
    // beforeBuildCommand overwrites it with the real binary at bundle
    // time. The placeholder is an executable shell script that
    // complains loudly if it ever ships in a release — distinct from
    // the real binary's `clap`-generated `--help` output.
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let drift_resource = manifest.join("target/release/drift");
    if !drift_resource.exists() {
        if let Some(parent) = drift_resource.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(
            &drift_resource,
            "#!/bin/sh\necho 'drift: placeholder binary — run `cargo tauri build` for the real CLI' >&2\nexit 1\n",
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = std::fs::metadata(&drift_resource) {
                let mut perm = meta.permissions();
                perm.set_mode(0o755);
                let _ = std::fs::set_permissions(&drift_resource, perm);
            }
        }
    }

    tauri_build::build();

    // The localhost HTTP server (`crate::http_server`) embeds the static-
    // profiler viewer via `rust-embed`. Its derive scans the folder at
    // **compile time**, so the directory must exist or the crate fails to
    // build. On a fresh clone the dev may not have run `npm run build` in
    // the viewer yet — create the dir and drop a stub index.html so the
    // crate still compiles. The HTTP server serves the stub until a real
    // build happens.
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let viewer_dist = manifest.join("../../drift-static-profiler/viewer/dist");
    if let Err(e) = std::fs::create_dir_all(&viewer_dist) {
        println!("cargo:warning=could not create {}: {e}", viewer_dist.display());
    }
    let stub_index = viewer_dist.join("index.html");
    if !stub_index.exists() {
        let _ = std::fs::write(
            &stub_index,
            format!(
                r#"{STUB_SENTINEL}
<!doctype html><meta charset="utf-8"><title>drift viewer (stub)</title>
<body style="font-family:system-ui;padding:2rem">
<h1>Static-profiler viewer not built</h1>
<p>This is the placeholder <code>build.rs</code> drops when the viewer's
<code>dist/</code> folder is empty. To get the real viewer:</p>
<pre>cd drift-static-profiler/viewer
npm install &amp;&amp; npm run build</pre>
<p>From the repo root, <code>make drift-lab-viewer-bundle</code> does this
in one step (and is wired into <code>make dev</code>, <code>make
drift-lab-build</code>, and CI).</p>
<p>The local REST API is still available at <a href="/docs">/docs</a>.</p>
"#
            ),
        );
    }

    // Loud warning when the embedded viewer is the stub. This is the only
    // signal a release build gets that someone bypassed the Makefile/CI
    // viewer-bundle step — the resulting .app would otherwise *silently*
    // ship the placeholder. cargo:warning is surfaced by tauri-cli and
    // shows up in CI logs.
    if let Ok(html) = std::fs::read_to_string(&stub_index) {
        if html.contains(STUB_SENTINEL) {
            println!(
                "cargo:warning=Embedding STUB viewer — \
                 drift-static-profiler/viewer/dist/ has no real Vite build. \
                 Run `make drift-lab-viewer-bundle` (or `make dev`) before \
                 `cargo tauri build` so the desktop bundle ships the real viewer."
            );
        }
    }

    // Rebuild when the viewer's built output or its sources change. We don't
    // run npm here — that's the user's `make` flow — but we DO want the
    // embedded bytes to refresh after a manual `npm run build`.
    let viewer_src = manifest.join("../../drift-static-profiler/viewer/src");
    println!("cargo:rerun-if-changed={}", viewer_dist.display());
    println!("cargo:rerun-if-changed={}", viewer_src.display());
}
