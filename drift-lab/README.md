# Drift Lab

Desktop app for profiling Dockerized services. Built with **Tauri 2 + React 18
+ TypeScript + Rust**.

---

## The 3 commands

```sh
make            # ① run with hot reload (ctrl+C to stop)
make compile    # ② release build for this OS (.app + .dmg on macOS)
make ship       # ③ compile, then open the built .app
```

That's the daily loop. Everything else is below.

---

## First-time setup

```sh
make setup      # installs rustup + tauri-cli + generates icons + npm install
```

If you'd rather do it piece by piece:

```sh
make install-rust         # rustup (curl | sh, default profile)
make install-tauri-cli    # cargo install tauri-cli (~3-5 min)
make icons                # generate every platform icon from icon-source.png
make install-js           # npm install in desktop-ui/
```

After `install-rust` you may need a fresh terminal so `cargo` is on PATH
(or `source $HOME/.cargo/env`).

---

## All Make targets

| Tier        | Target              | What it does |
| ----------- | ------------------- | ------------ |
| **①**       | `make` / `make dev` | Hot-reload native app. ctrl+C stops; `.tsx` edits HMR; `.rs` edits trigger a rebuild + relaunch. |
| **②**       | `make compile`      | Release build for the host OS. macOS → `.app` + `.dmg`. Linux → `.deb` + AppImage. |
| **③**       | `make ship`         | `make compile` then `open` the resulting `.app`. |
| Setup       | `make setup`        | install-rust + install-tauri-cli + icons + install-js (idempotent). |
| Setup       | `make install-rust` | One-time rustup install (skips if already installed). |
| Setup       | `make install-tauri-cli` | One-time `cargo install tauri-cli`. |
| Setup       | `make install-js`   | `npm install` in `desktop-ui/`. Auto-runs from dev/compile. |
| Setup       | `make check-rust`   | Fails with a hint if cargo or cargo-tauri are missing. |
| Setup       | `make icons`        | Regenerate the full icon set from `src-tauri/icon-source.png`. Auto-creates a placeholder source if missing. |
| Dev         | `make run`          | Alias for `make dev`. |
| Dev         | `make ui`           | Vite dev server only (no Rust). React app runs in browser at `http://localhost:1420` with a mocked IPC layer. Useful for designers without Rust installed. |
| Compile     | `make compile-mac`  | Same as `compile`; errors out if not on macOS. |
| Compile     | `make compile-linux`| Cross-builds Linux `.deb` + AppImage **inside Docker** (works from macOS). Output lands in `src-tauri/target-linux/release/bundle/`. |
| Launch      | `make open`         | Open the most-recently-built `Drift Lab.app` on macOS. |
| Cleanup     | `make clean`        | Remove `dist/`, bundles, Linux target. Keeps `node_modules` and Rust cache. |
| Cleanup     | `make distclean`    | Also nuke `node_modules`, `src-tauri/target`, `.cargo-linux`. Full reset. |
| Help        | `make help`         | Print the live target list with descriptions. |

---

## Manual / underlying commands

If you'd rather skip the Makefile, here's what each target actually runs.

```sh
# === Setup ===
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
cargo install tauri-cli --version "^2.0" --locked
cd src-tauri && cargo tauri icon icon-source.png

cd desktop-ui && npm install

# === Dev ===
cargo tauri dev                                 # native app, hot reload
cd desktop-ui && npm run dev                    # frontend only (mock IPC)

# === Build ===
cargo tauri build                               # release for this OS
cargo tauri build --bundles deb,appimage        # explicit bundle targets

# === Launch ===
open "src-tauri/target/release/bundle/macos/Drift Lab.app"
```

### Linux build via Docker (manual)

```sh
cd desktop-ui && npm run build && cd ..
docker run --rm --platform linux/amd64 \
  -v "$(pwd):/work" -w /work/src-tauri \
  -e CARGO_HOME=/work/.cargo-linux \
  -e CARGO_TARGET_DIR=/work/src-tauri/target-linux \
  rust:1.82-bookworm bash -lc '
    apt-get update -qq && apt-get install -y -qq \
      libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev \
      libayatana-appindicator3-dev librsvg2-dev pkg-config libsoup-3.0-dev && \
    cargo install tauri-cli --version "^2.0" --locked --quiet && \
    cargo tauri build --bundles deb,appimage'
```

---

## Stack

| Layer            | Choice                                |
| ---------------- | ------------------------------------- |
| Shell            | Tauri 2                               |
| Backend          | Rust (`tokio`, `bollard`, `sqlx`)     |
| Frontend         | React 18 + Vite + TypeScript          |
| Routing          | `react-router-dom`                    |
| FE state         | Zustand · TanStack Query              |
| Local DB         | SQLite via `sqlx`                     |
| Tauri plugins    | `dialog`, `fs`, `log`, `opener`, `updater`, `window-state`, built-in `tray-icon` |

## Layout

```
drift-lab/
  Makefile              # one-command dev/compile (you are here)
  desktop-ui/           # React + Vite + TS
    package.json
    index.html
    vite.config.ts
    src/
      main.tsx App.tsx
      pages/ components/ lib/ store/ styles/
  src-tauri/            # Rust crate (Tauri shell + workflow + docker + db)
    Cargo.toml tauri.conf.json build.rs
    capabilities/default.json
    icon-source.png     # 1024x1024 master — feed for `make icons`
    icons/              # generated PNGs + .icns + .ico
    src/
      main.rs lib.rs
      commands.rs       # #[tauri::command]s
      workflow.rs       # 5-stage pipeline (currently stubbed)
      docker.rs         # bollard wrappers
      db.rs             # sqlite pool + schema
      events.rs         # serde payloads
      tray.rs           # system tray menu
```

## How the workflow runs

1. UI calls `startRun(projectPath)` → Tauri command spawns a tokio task and
   returns a `runId` immediately.
2. Rust streams progress as `run://step` events, terminating with
   `run://complete` (or `run://error`).
3. The React `runStore` (Zustand) listens to those events; the page renders
   idle / running / done off store state.
4. Outside Tauri (`make ui`), the same surface is served by an in-process mock
   in `desktop-ui/src/lib/tauri.ts`, so the UI animates without the Rust side
   built.

## Wiring real work

Stages live in [`src-tauri/src/workflow.rs`](src-tauri/src/workflow.rs). Each
calls `run_stage(index)` which currently `tokio::sleep`s. Replace with:

| Stage | Real implementation |
| ----- | ------------------- |
| 0 — Locate Docker image | `docker::find_image(path)` (parse Dockerfile / compose) |
| 1 — Detect runtime      | `docker::inspect_layers(image)` + heuristic |
| 2 — Install profiler    | `bollard` exec into container, drop py-spy/async-profiler |
| 3 — Run profiling       | drive load (reqwest / vegeta sidecar), collect samples |
| 4 — Analyze             | parse samples, rank, persist to sqlite via `db::pool()` |

Persisted runs land in the `runs` table created by [`src-tauri/src/db.rs`](src-tauri/src/db.rs).
