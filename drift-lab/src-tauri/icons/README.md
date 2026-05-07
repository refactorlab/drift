# Icons

This directory must contain the icon files referenced from `tauri.conf.json`:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

Generate them all from a single 1024×1024 PNG with:

```sh
# from the repo root, after Rust + tauri-cli are installed
cargo tauri icon path/to/source-1024.png
```

That command writes the full set into this folder. Until then, `cargo tauri dev`
and `cargo tauri build` will fail because the bundle can't find them.
